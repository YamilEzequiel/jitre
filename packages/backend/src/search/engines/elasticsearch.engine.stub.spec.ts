import { NotImplementedException } from '@nestjs/common';
import { ElasticsearchEngine } from './elasticsearch.engine.stub';

describe('ElasticsearchEngine stub', () => {
  let engine: ElasticsearchEngine;

  beforeEach(() => {
    engine = new ElasticsearchEngine();
  });

  it('upsert throws NotImplementedException', async () => {
    await expect(
      engine.upsert({
        workspaceId: 'W1',
        entityType: 'comment',
        entityId: 'C1',
        content: 'x',
      }),
    ).rejects.toThrow(NotImplementedException);
  });

  it('delete throws NotImplementedException', async () => {
    await expect(engine.delete('W1', 'comment', 'C1')).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('search throws NotImplementedException', async () => {
    await expect(
      engine.search({ workspaceId: 'W1', query: 'test' }),
    ).rejects.toThrow(NotImplementedException);
  });
});
