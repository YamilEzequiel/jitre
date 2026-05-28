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
          >Elastic License 2.0</a>
          terms. Internal use — including commercial use within your organization — is
          permitted. Offering Jitre as a hosted or managed service to third parties is
          not. For a commercial / SaaS license, open an
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
            <p class="font-bold">Important: source-available &ne; open source</p>
            <p>
              You may use, modify, distribute and run Jitre inside your company — even
              for commercial purposes. You may <strong>not</strong> offer it to third
              parties as a hosted or managed service that exposes a substantial part of
              its functionality, nor remove the licensing notices.
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
            <li>Uso interno en empresas (incluso comercial).</li>
            <li>Uso personal, hobby y educativo.</li>
            <li>Investigaci&oacute;n y organizaciones sin fines de lucro.</li>
            <li>Forks, modificaciones y distribuci&oacute;n.</li>
            <li>Despliegues productivos dentro de tu organizaci&oacute;n.</li>
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
            <li>Ofrecerlo como SaaS / managed service a terceros.</li>
            <li>Eludir o deshabilitar el licensing.</li>
            <li>Remover los avisos de copyright o licencia.</li>
            <li>Re-brandear el producto bajo otra marca.</li>
            <li>Sublicenciarlo bajo otros t&eacute;rminos.</li>
          </ul>
        </div>
      </div>

      <article class="license-prose space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60 sm:p-8">
        <section>
          <h2>Acceptance</h2>
          <p>By using the software, you agree to all of the terms and conditions below.</p>
        </section>

        <section>
          <h2>Copyright License</h2>
          <p>
            The licensor grants you a non-exclusive, royalty-free, worldwide,
            non-sublicensable, non-transferable license to use, copy, distribute, make
            available, and prepare derivative works of the software, in each case
            subject to the limitations and conditions below.
          </p>
        </section>

        <section>
          <h2>Limitations</h2>
          <p>
            You may not provide the software to third parties as a hosted or managed
            service, where the service provides users with access to any substantial
            set of the features or functionality of the software.
          </p>
          <p>
            You may not move, change, disable, or circumvent the license key
            functionality in the software, and you may not remove or obscure any
            functionality in the software that is protected by the license key.
          </p>
          <p>
            You may not alter, remove, or obscure any licensing, copyright, or other
            notices of the licensor in the software. Any use of the licensor's
            trademarks is subject to applicable law.
          </p>
        </section>

        <section>
          <h2>Patents</h2>
          <p>
            The licensor grants you a license, under any patent claims the licensor can
            license, or becomes able to license, to make, have made, use, sell, offer
            for sale, import and have imported the software, in each case subject to
            the limitations and conditions in this license. This license does not cover
            any patent claims that you cause to be infringed by modifications or
            additions to the software. If you or your company make any written claim
            that the software infringes or contributes to infringement of any patent,
            your patent license for the software granted under these terms ends
            immediately. If your company makes such a claim, your patent license ends
            immediately for work on behalf of your company.
          </p>
        </section>

        <section>
          <h2>Notices</h2>
          <p>
            You must ensure that anyone who gets a copy of any part of the software
            from you also gets a copy of these terms.
          </p>
          <p>
            If you modify the software, you must include in any modified copies of the
            software prominent notices stating that you have modified the software.
          </p>
        </section>

        <section>
          <h2>No Other Rights</h2>
          <p>These terms do not imply any licenses other than those expressly granted in these terms.</p>
        </section>

        <section>
          <h2>Termination</h2>
          <p>
            If you use the software in violation of these terms, such use is not
            licensed, and your licenses will automatically terminate. If the licensor
            provides you with a notice of your violation, and you cease all violation
            of this license no later than 30 days after you receive that notice, your
            licenses will be reinstated retroactively. However, if you violate these
            terms after such reinstatement, any additional violation of these terms
            will cause your licenses to terminate automatically and permanently.
          </p>
        </section>

        <section>
          <h2>No Liability</h2>
          <p class="rounded-lg border border-rose-200 bg-rose-50/60 px-4 py-3 font-semibold text-rose-900">
            As far as the law allows, the software comes as is, without any warranty
            or condition, and the licensor will not be liable to you for any damages
            arising out of these terms or the use or nature of the software, under any
            kind of legal claim.
          </p>
        </section>

        <section>
          <h2>Definitions</h2>
          <p>
            The <strong>licensor</strong> is the entity offering these terms, and the
            <strong>software</strong> is the software the licensor makes available
            under these terms, including any portion of it.
          </p>
          <p><strong>you</strong> refers to the individual or entity agreeing to these terms.</p>
          <p>
            <strong>your company</strong> is any legal entity, sole proprietorship, or
            other kind of organization that you work for, plus all organizations that
            have control over, are under the control of, or are under common control
            with that organization. <strong>control</strong> means ownership of
            substantially all the assets of an entity, or the power to direct its
            management and policies by vote, contract, or otherwise. Control can be
            direct or indirect.
          </p>
          <p>
            <strong>your licenses</strong> are all the licenses granted to you for the
            software under these terms.
          </p>
          <p><strong>use</strong> means anything you do with the software requiring one of your licenses.</p>
          <p><strong>trademark</strong> means trademarks, service marks, and similar rights.</p>
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
            >elastic.co/licensing/elastic-license</a>
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
