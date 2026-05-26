import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Document,
  DocumentApiService,
  DocumentCreateBody,
  DocumentListFilters,
  DocumentMoveBody,
  DocumentUpdateBody,
} from './document-api.service';

/**
 * Signal-based store for documents.
 *
 * Unlike entity-store.factory, docs need a tree representation that mirrors
 * what the backend returns from /tree. We keep two things:
 *   - `byId`: a flat dictionary for cheap O(1) lookup when navigating
 *     to a single doc.
 *   - `tree`: the raw nested structure last fetched via loadTree, used to
 *     drive the sidebar nav.
 *
 * Both are signals so views can recompute reactively. Search is a
 * pass-through to the API (no caching) — results are intentionally ephemeral.
 */
@Injectable({ providedIn: 'root' })
export class DocumentStore {
  private readonly api = inject(DocumentApiService);

  private readonly _tree = signal<Document[]>([]);
  private readonly _byId = signal<Record<string, Document>>({});
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly tree = this._tree.asReadonly();
  readonly byId = this._byId.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Flat list derived from the byId map — useful for autocomplete etc. */
  readonly items = computed<Document[]>(() => Object.values(this._byId()));

  async loadTree(projectId?: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const roots = await this.api.tree(projectId);
      this._tree.set(roots);
      // Walk the tree and index every node so byId is in sync with the
      // tree we just fetched. Children carried by the response stay nested
      // (we don't strip the children prop) so consumers that read byId
      // still see the same shape they'd get from /documents/:id.
      const flat: Record<string, Document> = {};
      const visit = (node: Document): void => {
        flat[node.id] = node;
        for (const child of node.children ?? []) visit(child);
      };
      for (const root of roots) visit(root);
      this._byId.set(flat);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load documents');
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async loadById(id: string): Promise<Document> {
    const doc = await this.api.getById(id);
    this.upsert(doc);
    return doc;
  }

  async create(body: DocumentCreateBody): Promise<Document> {
    const doc = await this.api.create(body);
    this.upsert(doc);
    // Also splice into tree at the appropriate place so the sidebar updates
    // without a full reload.
    this._tree.update(tree => insertIntoTree(tree, doc));
    return doc;
  }

  async update(id: string, patch: DocumentUpdateBody): Promise<Document> {
    const doc = await this.api.update(id, patch);
    this.upsert(doc);
    this._tree.update(tree => replaceInTree(tree, doc));
    return doc;
  }

  async move(id: string, body: DocumentMoveBody): Promise<Document> {
    const doc = await this.api.move(id, body);
    this.upsert(doc);
    // Rather than surgically patching the tree (parent + order changes are
    // hairy), refetch when we move. Cheap enough since /tree is one call.
    return doc;
  }

  async delete(id: string): Promise<void> {
    await this.api.delete(id);
    const removedIds = new Set([id, ...collectDescendantIds(this._tree(), id)]);
    this._byId.update(map =>
      Object.fromEntries(
        Object.entries(map).filter(([docId]) => !removedIds.has(docId)),
      ),
    );
    this._tree.update(tree => removeFromTree(tree, id));
  }

  /**
   * Pass-through search. No caching — results are intentionally ephemeral so
   * search UIs always reflect the latest backend state.
   */
  search(q: string, filters: Omit<DocumentListFilters, 'q'> = {}): Promise<Document[]> {
    return this.api.list({ ...filters, q });
  }

  /** Search helper that also lists (for parent/project filters without q). */
  list(filters: DocumentListFilters = {}): Promise<Document[]> {
    return this.api.list(filters);
  }

  upsert(doc: Document): void {
    this._byId.update(map => ({ ...map, [doc.id]: doc }));
  }

  remove(id: string): void {
    this._byId.update(map => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _omit, ...rest } = map;
      return rest;
    });
  }

  clear(): void {
    this._byId.set({});
    this._tree.set([]);
    this._error.set(null);
  }
}

/**
 * Insert a newly-created doc into the tree at the parent indicated by its
 * `parentId`. If `parentId` is null it becomes a root. If we can't find the
 * parent (stale cache, race condition) the doc is appended at the root —
 * better than dropping it silently; the next /tree fetch fixes it.
 */
function insertIntoTree(tree: Document[], doc: Document): Document[] {
  if (doc.parentId === null) {
    return [...tree, { ...doc, children: doc.children ?? [] }];
  }
  let inserted = false;
  const next = tree.map(node => {
    const result = insertChild(node, doc);
    if (result.inserted) inserted = true;
    return result.node;
  });
  if (!inserted) {
    // Parent not found in cached tree — fall back to root insert.
    return [...next, { ...doc, children: doc.children ?? [] }];
  }
  return next;
}

function insertChild(
  node: Document,
  doc: Document,
): { node: Document; inserted: boolean } {
  if (node.id === doc.parentId) {
    return {
      node: { ...node, children: [...(node.children ?? []), doc] },
      inserted: true,
    };
  }
  let inserted = false;
  const children = (node.children ?? []).map(child => {
    const result = insertChild(child, doc);
    if (result.inserted) inserted = true;
    return result.node;
  });
  return { node: { ...node, children }, inserted };
}

function replaceInTree(tree: Document[], doc: Document): Document[] {
  return tree.map(node => replaceNode(node, doc));
}

function replaceNode(node: Document, doc: Document): Document {
  if (node.id === doc.id) {
    // Preserve existing children — patch only top-level fields.
    return { ...doc, children: node.children ?? doc.children ?? [] };
  }
  return {
    ...node,
    children: (node.children ?? []).map(child => replaceNode(child, doc)),
  };
}

function removeFromTree(tree: Document[], id: string): Document[] {
  return tree
    .filter(n => n.id !== id)
    .map(n => ({
      ...n,
      children: removeFromTree(n.children ?? [], id),
    }));
}

function collectDescendantIds(tree: Document[], id: string): string[] {
  for (const node of tree) {
    if (node.id === id) {
      const ids: string[] = [];
      const visit = (doc: Document): void => {
        for (const child of doc.children ?? []) {
          ids.push(child.id);
          visit(child);
        }
      };
      visit(node);
      return ids;
    }
    const nested = collectDescendantIds(node.children ?? [], id);
    if (nested.length > 0) return nested;
  }
  return [];
}
