import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LICENSE_NAME, LICENSE_URL, REPO_ISSUES_URL } from '../../core/app-info';

@Component({
  selector: 'jt-license',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-[52rem] space-y-8 px-4 py-8 text-slate-950">
      <header class="space-y-3">
        <div class="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1">
          <span class="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true"></span>
          <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
            License
          </span>
        </div>
        <h1 class="text-3xl font-black tracking-tight sm:text-4xl">
          <span
            class="block bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent"
          >
            {{ licenseName }}
          </span>
        </h1>
        <p class="max-w-xl text-sm leading-relaxed text-slate-500">
          Jitre is source-available under the
          <a
            [href]="licenseUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="font-semibold text-indigo-600 transition hover:text-violet-700"
          >PolyForm Noncommercial 1.0.0</a>
          terms. Personal, research, educational and noncommercial use is permitted.
          Commercial use is not. For commercial licensing, open an
          <a
            [href]="issuesUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="font-semibold text-indigo-600 transition hover:text-violet-700"
          >issue on GitHub</a>.
        </p>
      </header>

      <div
        class="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/80 to-rose-50/50 p-5"
      >
        <div class="flex items-start gap-3">
          <span
            class="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-amber-100 text-amber-700"
            aria-hidden="true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="m10.29 3.86-8.4 14.55a2 2 0 0 0 1.74 3h16.74a2 2 0 0 0 1.74-3l-8.4-14.55a2 2 0 0 0-3.42 0Z" />
            </svg>
          </span>
          <div class="space-y-1 text-sm leading-relaxed text-amber-900">
            <p class="font-bold">Important: source-available ≠ open source</p>
            <p>
              You may read, modify and redistribute the code for noncommercial purposes,
              but you may <strong>not</strong> sell it, host it as a paid service, or
              integrate it into a commercial product without a separate commercial
              agreement.
            </p>
          </div>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div class="mb-2 flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <h3 class="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Permitido</h3>
          </div>
          <ul class="space-y-1 text-sm text-emerald-900">
            <li>Uso personal y dom&eacute;stico.</li>
            <li>Investigaci&oacute;n y educaci&oacute;n.</li>
            <li>Organizaciones sin fines de lucro.</li>
            <li>Forks y modificaciones no comerciales.</li>
            <li>Hobbies, estudio y experimentaci&oacute;n.</li>
          </ul>
        </div>
        <div class="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
          <div class="mb-2 flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-md bg-rose-100 text-rose-700">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
            <h3 class="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-700">No permitido</h3>
          </div>
          <ul class="space-y-1 text-sm text-rose-900">
            <li>Revender el software.</li>
            <li>Ofrecerlo como SaaS pago.</li>
            <li>Incluirlo en productos comerciales.</li>
            <li>Hostearlo para clientes pagos.</li>
            <li>Cualquier uso con fin comercial.</li>
          </ul>
        </div>
      </div>

      <article class="license-prose space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60 sm:p-8">
        <section>
          <h2>Acceptance</h2>
          <p>
            In order to get any license under these terms, you must agree to them as both
            strict obligations and conditions to all your licenses.
          </p>
        </section>

        <section>
          <h2>Copyright License</h2>
          <p>
            The licensor grants you a copyright license for the software to do everything
            you might do with the software that would otherwise infringe the licensor's
            copyright in it for any permitted purpose. However, you may only distribute
            the software according to <em class="not-italic font-semibold">Distribution License</em>
            and make changes or new works based on the software according to
            <em class="not-italic font-semibold">Changes and New Works License</em>.
          </p>
        </section>

        <section>
          <h2>Distribution License</h2>
          <p>
            The licensor grants you an additional copyright license to distribute copies of
            the software. Your license to distribute covers distributing the software with
            changes and new works permitted by Changes and New Works License.
          </p>
        </section>

        <section>
          <h2>Changes and New Works License</h2>
          <p>
            The licensor grants you an additional copyright license to make changes and new
            works based on the software for any permitted purpose.
          </p>
        </section>

        <section>
          <h2>Patent License</h2>
          <p>
            The licensor grants you a patent license for the software that covers patent
            claims the licensor can license, or becomes able to license, that you would
            infringe by using the software.
          </p>
        </section>

        <section>
          <h2>Noncommercial Purposes</h2>
          <p>Any noncommercial purpose is a permitted purpose.</p>
        </section>

        <section>
          <h2>Personal Uses</h2>
          <p>
            Personal use for research, experiment, and testing for the benefit of public
            knowledge, personal study, private entertainment, hobby projects, amateur
            pursuits, or religious observance, without any anticipated commercial
            application, is use for a permitted purpose.
          </p>
        </section>

        <section>
          <h2>Noncommercial Organizations</h2>
          <p>
            Use by any charitable organization, educational institution, public research
            organization, public safety or health organization, environmental protection
            organization, or government institution is use for a permitted purpose
            regardless of the source of funding or obligations resulting from the funding.
          </p>
        </section>

        <section>
          <h2>Fair Notice</h2>
          <p>If you use the software for a permitted purpose, you must give credit to the licensor by:</p>
          <ol class="list-decimal space-y-1 pl-6">
            <li>providing a copy of these terms with the software,</li>
            <li>labeling or otherwise prominently identifying the software as licensed under these terms, and</li>
            <li>including a notice that any other use of the software is prohibited under any other terms.</li>
          </ol>
        </section>

        <section>
          <h2>Patent Defense</h2>
          <p>
            If you make any written claim that the software infringes or contributes to
            infringement of any patent, your patent license for the software granted under
            these terms ends immediately. If your company makes such a claim, your patent
            license ends immediately for work on behalf of your company.
          </p>
        </section>

        <section>
          <h2>Violations</h2>
          <p>
            The first time you are notified in writing that you have violated any of these
            terms, or done anything with the software not covered by your license, your
            license gives you 30 days to comply or stop using the software. If you do not,
            your license ends immediately.
          </p>
        </section>

        <section>
          <h2>No Liability</h2>
          <p class="rounded-lg border border-rose-200 bg-rose-50/60 px-4 py-3 font-semibold text-rose-900">
            As far as the law allows, the software comes as is, without any warranty or
            condition, and the licensor will not be liable to you for any damages arising
            out of these terms or the use or nature of the software, under any kind of
            legal claim.
          </p>
        </section>

        <section>
          <h2>Definitions</h2>
          <p>
            The <strong>licensor</strong> is the individual or entity offering these terms,
            and the <strong>software</strong> is the software the licensor makes available
            under these terms.
          </p>
          <p><strong>You</strong> refers to the individual or entity agreeing to these terms.</p>
          <p>
            <strong>Your company</strong> is any legal entity, sole proprietorship, or
            other kind of organization that you work for, plus all organizations that have
            control over, are under the control of, or are under common control with that
            organization. <strong>Control</strong> means ownership of substantially all the
            assets of an entity, or the power to direct its management and policies by
            vote, contract, or otherwise. Control can be direct or indirect.
          </p>
          <p>
            <strong>Your licenses</strong> are all the licenses granted to you for the
            software under these terms.
          </p>
          <p><strong>Use</strong> means anything you do with the software requiring one of your licenses.</p>
        </section>

        <hr class="border-slate-200" />

        <section>
          <p class="text-xs text-slate-500">
            Required Notice: Copyright &copy; Yamil Lazzari. All rights reserved.<br />
            Full text:
            <a
              [href]="licenseUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="font-semibold text-indigo-600 hover:text-violet-700"
            >polyformproject.org/licenses/noncommercial/1.0.0</a>
          </p>
        </section>
      </article>
    </div>
  `,
  styles: [
    `
      .license-prose h2 {
        font-size: 0.7rem;
        font-weight: 800;
        color: rgb(15, 23, 42);
        text-transform: uppercase;
        letter-spacing: 0.14em;
        margin: 0 0 0.5rem 0;
      }
      .license-prose p {
        font-size: 0.9rem;
        line-height: 1.65;
        color: rgb(51, 65, 85);
        margin: 0 0 0.5rem 0;
      }
      .license-prose strong {
        color: rgb(15, 23, 42);
      }
    `,
  ],
})
export class LicenseComponent {
  readonly licenseName = LICENSE_NAME;
  readonly licenseUrl = LICENSE_URL;
  readonly issuesUrl = REPO_ISSUES_URL;
}
