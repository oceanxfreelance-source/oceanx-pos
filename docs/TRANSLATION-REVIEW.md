# Dhivehi translation review

Generated from `packages/shared/locales/review/dv.json` — edit that file, then run
`npx tsx packages/shared/scripts/review-md.ts`.

Status: **needs_review**: 654 · **confirmed**: 144

All other Dhivehi strings (`packages/shared/locales/dv.json`, 764 keys) are complete drafts using common Maldivian
business usage (English loanwords in Thaana for system terms such as ޕާސްވޯޑް, ސެޓިންގްސް, އިންވޮއިސް). A native
review of the whole file is still recommended before launch.

| Translation key | English | Suggested Dhivehi | Status | Notes |
| --- | --- | --- | --- | --- |
| `activity.actions.karaoke_no_show` | Karaoke booking no-show | ކަރައޮކޭ ބުކިންގ – ނާދޭ | needs_review | Uses dash '–' between noun and status; see status_labels.no_show. |
| `addons.cancel_request` | Cancel request | އެދުން ކެންސަލްކުރޭ | needs_review | Plain translation using existing app terms. |
| `addons.categories.staff` | Staff | ސްޓާފުން | needs_review | Plain translation using existing app terms. |
| `addons.descriptions.payroll` | Staff list and monthly salary sheets with allowances, overtime, deductions and advances. | ސްޓާފުންގެ ލިސްޓާއި، އެލަވަންސް، އޯވަޓައިމް، ކެނޑުންތަކާއި އެޑްވާންސްއާއެކު މަހުން މަހަށް މުސާރަ ޝީޓް. | needs_review | Allowances = އެލަވަންސް, deductions = ކެނޑުންތައް, advances = އެޑްވާންސް. Check these match the owner's payslip vocabulary. |
| `addons.descriptions.staff_rota` | Weekly duty rota: shifts, days off and leave for every staff member. | ހަފްތާގެ ޑިއުޓީ ރޯސްޓަރު: ކޮންމެ ސްޓާފަކުގެ ޝިފްޓު، އޯފް ދުވަސްތަކާއި ޗުއްޓީ. | needs_review | "Days off" = އޯފް ދުވަސްތައް; "leave" = ޗުއްޓީ. |
| `addons.names.credit` | Credit / Customer Due | ކްރެޑިޓް / ކަސްޓަމަރުގެ ދަރަނި | needs_review | Business terminology decision: ދަރަނި (debt) vs ކްރެޑިޓް. Spec requires 'Credit Sale / Customer Due / Outstanding Balance / Credit Payment' wording — please confirm Dhivehi equivalents before Phase 4. |
| `addons.names.payroll` | Payroll (Salary Sheet) | ޕޭރޯލް (މުސާރަ ޝީޓް) | needs_review | "Payroll" kept as loanword ޕޭރޯލް. |
| `addons.names.staff_rota` | Duty Rota | ޑިއުޓީ ރޯސްޓަރު | needs_review | Plain translation using existing app terms. |
| `addons.request` | Request | އެދޭ | needs_review | Verb "request" = އެދޭ (as in viber.request). |
| `addons.request_cancelled` | Request cancelled | އެދުން ކެންސަލްކުރެވިއްޖެ | needs_review | Plain translation using existing app terms. |
| `addons.request_sent` | Request sent. The platform team will switch it on. | އެދުން ފޮނުވިއްޖެ. ޕްލެޓްފޯމް ޓީމުން މި ހުޅުވައިދޭނެ. | needs_review | Platform team = ޕްލެޓްފޯމް ޓީމު (as in addons.request_hint). |
| `addons.requested_on` | Requested {{date}} | {{date}} ގައި އެދިފައި | needs_review | Plain translation using existing app terms. |
| `app.install` | Install app | އެޕް އިންސްޓޯލް ކުރައްވާ | needs_review | New: install the app on a tablet. |
| `app.install_ios` | In Safari, tap the Share button, then “Add to Home Screen”. | ސަފާރީގައި ޝެއާ ބަޓަން ފިތާލުމަށްފަހު "Add to Home Screen" އަށް ފިއްތަވާ. | needs_review | New: install the app on a tablet. |
| `app.tagline` | Restaurant, Café & Shop Management | ރެސްޓޯރަންޓް، ކެފޭ އަދި ފިހާރަ ހިންގުން | needs_review | New/updated: shops on the platform. |
| `auth.aside_body` | Sales, stock, staff and reports for restaurants, cafés and shops — in your language, on any device. | ރެސްޓޯރަންޓް، ކެފޭ އަދި ފިހާރަތަކަށް ވިއްކުމާއި، ސްޓޮކާއި، ސްޓާފާއި ރިޕޯޓްތައް — ތިބާގެ ބަހުން، ކޮންމެ ޑިވައިސްއެއްގައި. | needs_review | New/updated: shops on the platform. |
| `auth.aside_title` | Run your restaurant, café or shop with confidence. | ރެސްޓޯރަންޓް، ކެފޭ ނުވަތަ ފިހާރަ ޔަގީންކަމާއެކު ހިންގާ. | needs_review | New/updated: shops on the platform. |
| `auth.register_subtitle` | Set up your restaurant, café or shop in a few minutes. | ރެސްޓޯރަންޓް، ކެފޭ ނުވަތަ ފިހާރަ މިނިޓު ކިހާވަރަކުން ތައްޔާރުކުރައްވާ. | needs_review | New/updated: shops on the platform. |
| `billing.amount` | Amount | އަދަދު | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.amount_to_pay` | Amount to pay | ދައްކަންޖެހޭ އަދަދު | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.ask_owner` | Please ask the business owner or a manager to pay for the plan. | ޕްލޭނަށް ފައިސާ ދެއްކުމަށް ވިޔަފާރީގެ ވެރިފަރާތަށް ނުވަތަ މެނޭޖަރަކަށް އެދިވަޑައިގަންނަވާ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.bank_details` | Pay by bank transfer to | ބޭންކް ޓްރާންސްފަރ ކުރާނީ މި އެކައުންޓަށް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.bank_details_missing` | Bank details will be shared by the OceanX team. Please contact them. | ބޭންކް މަޢުލޫމާތު OceanX ޓީމުން ދެއްވާނެ. އެ ޓީމާ ގުޅުއްވާ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.banner_paid_one` | Your {{plan}} plan ends in {{count}} day. | ތިޔަ {{plan}} ޕްލޭން ނިމެން {{count}} ދުވަސް ބާކީ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.banner_paid_other` | Your {{plan}} plan ends in {{count}} days. | ތިޔަ {{plan}} ޕްލޭން ނިމެން {{count}} ދުވަސް ބާކީ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.banner_pending` | Your payment slip is being reviewed by the OceanX team. | ތިޔަ ފައިސާ ދެއްކި ސްލިޕް OceanX ޓީމުން ޗެކްކުރަމުން. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.banner_trial_one` | Your free trial ends in {{count}} day. | ތިޔަ ހިލޭ ޓްރަޔަލް ނިމެން {{count}} ދުވަސް ބާކީ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.banner_trial_other` | Your free trial ends in {{count}} days. | ތިޔަ ހިލޭ ޓްރަޔަލް ނިމެން {{count}} ދުވަސް ބާކީ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.blocked_body` | Your {{plan}} period ended on {{date}}. Pay for a plan below to keep using OceanX — your data is safe. | ތިޔަ {{plan}} މުއްދަތު {{date}} ގައި ނިމިއްޖެ. OceanX ކުރިއަށް ބޭނުންކުރުމަށް ތިރީގައިވާ ޕްލޭނެއްގެ ފައިސާ ދައްކަވާ — ތިޔަ ޑޭޓާ ރައްކާތެރިކަމާއެކު ހުންނާނެ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.choose_plan` | Choose a plan | ޕްލޭނެއް ހޮވާ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.current_plan` | Current plan | މިހާރުގެ ޕްލޭން | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.ended_on` | Ended on {{date}} | {{date}} ގައި ނިމުނު | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.ends_on_one` | Ends on {{date}} ({{count}} day left) | {{date}} ގައި ނިމޭނެ ({{count}} ދުވަސް ބާކީ) | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.ends_on_other` | Ends on {{date}} ({{count}} days left) | {{date}} ގައި ނިމޭނެ ({{count}} ދުވަސް ބާކީ) | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.file_too_big` | The file is larger than 5 MB. | ފައިލް 5 MB އަށް ވުރެ ބޮޑު. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.history` | Payments | ފައިސާ ދެއްކުންތައް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.month` | month | މަސް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.months_one` | {{count}} month | {{count}} މަސް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.months_other` | {{count}} months | {{count}} މަސް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.no_payments` | No payments yet. | އަދި އެއްވެސް ފައިސާއެއް ދައްކާފައެއް ނުވޭ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.no_plans` | No plans are available right now. Please contact the OceanX team. | މިވަގުތު އެއްވެސް ޕްލޭނެއް ނެތް. OceanX ޓީމާ ގުޅުއްވާ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.pay_hint` | Pay by bank transfer and upload the slip. Our team checks it and activates your plan. | ބޭންކް ޓްރާންސްފަރ އިން ފައިސާ ދައްކަވާފައި ސްލިޕް އަޕްލޯޑް ކުރައްވާ. އަހަރެމެންގެ ޓީމުން އެ ޗެކްކޮށް ތިޔަ ޕްލޭން އެކްޓިވް ކޮށްދޭނެ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.pay_now` | Pay now | މިހާރު ފައިސާ ދައްކަވާ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.pay_title` | Pay for your plan | ޕްލޭނަށް ފައިސާ ދައްކަވާ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.period` | How many months | ކިތައް މަހަށް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.plan` | Plan | ޕްލޭން | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.receipt` | Receipt | ރަސީދު | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.reference` | Transfer reference (optional) | ޓްރާންސްފަރ ރެފަރެންސް (ބޭނުންނަމަ) | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.reference_hint` | The reference or transaction number from your bank app. | ތިޔަ ބޭންކް އެޕުން ލިބޭ ރެފަރެންސް ނުވަތަ ޓްރާންޒެކްޝަން ނަންބަރު. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.rejected_retry` | Please check and upload the slip again. | ޗެކްކޮށްލައްވާފައި ސްލިޕް އަލުން އަޕްލޯޑް ކުރައްވާ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.rejected_title` | Your last payment was not accepted | ފަހުން ދެއްކި ފައިސާ ޤަބޫލެއް ނުކުރެވުނު | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.send_slip` | Send slip for review | ސްލިޕް ޗެކްކުރުމަށް ފޮނުވާ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.slip_sent` | Slip sent. Our team will check it shortly. | ސްލިޕް ފޮނުވައިފި. އަހަރެމެންގެ ޓީމުން އަވަހަށް އެ ޗެކްކުރާނެ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.status` | Status | ސްޓޭޓަސް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.status_approved` | Approved | ޤަބޫލުކުރެވިއްޖެ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.status_pending` | Under review | ޗެކްކުރަމުން | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.status_rejected` | Rejected | ރުއްދުކުރެވިއްޖެ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.sub_active` | Active | އެކްޓިވް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.sub_cancelled` | Cancelled | ކެންސަލް ކުރެވިއްޖެ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.sub_expired` | Ended | ނިމިއްޖެ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.sub_past_due` | Payment due | ފައިސާ ދައްކަންޖެހޭ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.sub_trialing` | Free trial | ހިލޭ ޓްރަޔަލް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.subtitle` | Your OceanX plan, payments and receipts. | ތިޔަ OceanX ޕްލޭން، ފައިސާ ދެއްކުންތަކާއި ރަސީދުތައް. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.title` | Billing | ބިލިންގ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.trial_over_title` | Your free trial has ended | ތިޔަ ހިލޭ ޓްރަޔަލް ނިމިއްޖެ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.under_review` | Payment under review | ފައިސާ ދެއްކުން ޗެކްކުރަމުން | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.under_review_body` | We received your slip on {{date}}. Your plan is activated as soon as our team confirms the payment. | ތިޔަ ސްލިޕް {{date}} ގައި ލިބިއްޖެ. ފައިސާ ލިބުނުކަން އަހަރެމެންގެ ޓީމުން ކަށަވަރުކުރުމާއެކު ތިޔަ ޕްލޭން އެކްޓިވް ކުރެވޭނެ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.upload_slip` | Upload the transfer slip | ޓްރާންސްފަރ ސްލިޕް އަޕްލޯޑް ކުރައްވާ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.upload_slip_hint` | Photo or PDF of the slip (JPG, PNG or PDF, up to 5 MB). | ސްލިޕްގެ ފޮޓޯ ނުވަތަ PDF (JPG، PNG ނުވަތަ PDF، 5 MB އަށް ވުރެ ބޮޑު ނުވާ). | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `billing.view_slip` | View slip | ސްލިޕް ބައްލަވާ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `branding.choose_photo` | Choose a photo or scan | ފޮޓޯއެއް ނުވަތަ ސްކޭނެއް ޚިޔާރުކުރައްވާ | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.clear` | Clear | ފޮހެލާ | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.company_stamp` | Company stamp | ކުންފުނީގެ ތައްގަނޑު | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.company_stamp_hint` | Printed on quotations, invoices, statements, payment receipts and salary sheets. | ކޯޓޭޝަން، އިންވޮއިސް، ސްޓޭޓްމަންޓް، ފައިސާ ލިބުނު ރަސީދު އަދި މުސާރަ ޝީޓުގައި ޕްރިންޓްވާނެއެވެ. | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.draw` | Draw | ކުރަހާ | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.make_stamp` | Create stamp from business name | ވިޔަފާރީގެ ނަމުން ތައްގަނޑެއް ހަދާ | needs_review | New: auto-made company stamp. ތައްގަނޑު = stamp. |
| `branding.make_stamp_hint` | No stamp image? Create a round stamp with your business name. It is printed on quotations and invoices, and you can replace it with your own any time. | ތައްގަނޑުގެ ފޮޓޯއެއް ނެތްތޯ؟ ވިޔަފާރީގެ ނަން ލިޔެފައިވާ ވަށް ތައްގަނޑެއް ހަދާލައްވާ. އެ ތައްގަނޑު ކޯޓޭޝަނާއި އިންވޮއިސްތަކުގައި ޖެހޭނެ، އަދި ކޮންމެ ވަގުތެއްގައި ވެސް އަމިއްލަ ތައްގަނޑަކުން ބަދަލުކުރެވޭނެ. | needs_review | New: auto-made company stamp. ތައްގަނޑު = stamp. |
| `branding.my_signature` | My signature | އަޅުގަނޑުގެ ސޮއި | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.my_signature_hint` | Printed on quotations, invoices, statements, payment receipts and salary sheets you prepare. | ތިޔަބޭފުޅާ ތައްޔާރުކުރައްވާ ކޯޓޭޝަން، އިންވޮއިސް، ސްޓޭޓްމަންޓް، ފައިސާ ލިބުނު ރަސީދު އަދި މުސާރަ ޝީޓުގައި ޕްރިންޓްވާނެއެވެ. | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.pad_hint` | Sign inside the box with your mouse, pen or finger. | މައުސް، ގަލަން ނުވަތަ އިނގިލިން ބޮކްސް ތެރޭގައި ސޮއި ކުރައްވާ. | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.pad_label` | Signature pad | ސޮއި ކުރާ ތަން | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.photo_hint` | Use dark ink on white paper. The white paper is removed automatically. | ހުދު ކަރުދާހުގައި ކަޅު ތެލިން ހަދާފައިވާ ފޮޓޯއެއް ބޭނުންކުރައްވާ. ހުދު ކަރުދާސް އަމިއްލައަށް ނައްތާލެވޭނެއެވެ. | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.remove` | Remove | ނައްތާލާ | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.replace_photo` | Replace with a new photo | އައު ފޮޓޯއަކާ ބަދަލުކުރޭ | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.save_signature` | Save signature | ސޮއި ރައްކާކުރޭ | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.show_signature` | Show signatures on documents | ލިޔެކިޔުންތަކުގައި ސޮއި ދައްކާ | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.show_signature_hint` | The signature of the person who prepared the document. | ލިޔުން ތައްޔާރުކުރި މީހާގެ ސޮއި. | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.show_stamp` | Show the company stamp on documents | ލިޔެކިޔުންތަކުގައި ކުންފުނީގެ ތައްގަނޑު ޖަހާ | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.show_stamp_hint` | Turn off to print documents without the stamp. | ތައްގަނޑު ނުޖަހާ ލިޔެކިޔުން ޕްރިންޓްކުރުމަށް ނިއްވާލައްވާ. | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `branding.upload` | Upload photo | ފޮޓޯ އަޕްލޯޑްކުރޭ | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `business_types.retail_shop` | Shop | ފިހާރަ | needs_review | New: retail shops (stock check, barcode). |
| `business_types.supermarket` | Supermarket / big shop | ސުޕަރމާކެޓް / ބޮޑު ފިހާރަ | needs_review | New: retail shops (stock check, barcode). |
| `common.done` | Done | ނިމިއްޖެ | needs_review | Button that closes a finished step. |
| `common.exit_fullscreen` | Exit full screen | ފުލް ސްކްރީނުން ނިކުމެވޭ | needs_review | New: full screen button in the top bar and POS. |
| `common.fullscreen` | Full screen | ފުލް ސްކްރީން | needs_review | New: full screen button in the top bar and POS. |
| `common.update_available` | A new version of OceanX is available. | OceanX ގެ އައު ވަރޝަނެއް ލިބެން އެބައޮތް. | needs_review | Bar shown when an update is published while the app is open. |
| `credit.amount_paid` | Amount paid | ދެއްކި އަދަދު | needs_review | New: part payments of dues and payment receipt. |
| `credit.due_label` | Due | ދައްކަންޖެހޭ | needs_review | New: part payments of dues and payment receipt. |
| `credit.fifo_hint` | The payment is applied to the oldest unpaid bills first (credit sales and invoices). | ފައިސާ އެންމެ ފުރަތަމަ ކަނޑައެޅޭނީ ނުދައްކާ ހުރި އެންމެ ދުވަސްވީ ކްރެޑިޓް ވިއްކުންތަކަށެވެ. | needs_review | English changed: payments now also pay invoices, not only credit sales. Please update the Dhivehi. |
| `credit.fully_paid` | Fully paid | ފުރިހަމައަށް ދައްކާފައި | needs_review | New: part payments of dues and payment receipt. |
| `credit.more_than_due` | More than the amount due | ދައްކަންޖެހޭ އަދަދަށްވުރެ ގިނަ | needs_review | New: part payments of dues and payment receipt. |
| `credit.paid_now` | Paid now | މިހާރު ދެއްކި | needs_review | New: part payments of dues and payment receipt. |
| `credit.paid_towards` | Paid towards | ދެއްކީ މިއަށް | needs_review | New: part payments of dues and payment receipt. |
| `credit.pay_full` | Full amount | ފުރިހަމަ އަދަދު | needs_review | New: part payments of dues and payment receipt. |
| `credit.pay_half` | Half | ބައި | needs_review | New: part payments of dues and payment receipt. |
| `credit.payment_receipt` | Payment receipt | ފައިސާ ލިބުނު ރަސީދު | needs_review | New: part payments of dues and payment receipt. |
| `credit.print_receipt` | Print receipt | ރަސީދު ޕްރިންޓްކުރޭ | needs_review | New: part payments of dues and payment receipt. |
| `credit.remaining_after` | Remaining after this payment | މި ފައިސާ ދެއްކުމަށްފަހު ބާކީ | needs_review | New: part payments of dues and payment receipt. |
| `credit.still_due` | Still due | އަދިވެސް ދައްކަންޖެހޭ | needs_review | New: part payments of dues and payment receipt. |
| `credit.total_due_now` | Total due now | މިހާރު ދައްކަންޖެހޭ ޖުމްލަ | needs_review | New: part payments of dues and payment receipt. |
| `customers.kind` | Customer type | ކަސްޓަމަރުގެ ބާވަތް | needs_review | New: company and government accounts (PO / PV). |
| `customers.kind_hint` | Companies and government offices usually buy on invoice and pay later by PO and payment voucher. | ކުންފުނިތަކާއި ސަރުކާރު އޮފީސްތަކުން އާންމުކޮށް ގަންނަނީ އިންވޮއިހަށް، ފަހުން ޕީއޯ އާއި ޕޭމަންޓް ވައުޗަރުން ފައިސާ ދައްކައިގެން. | needs_review | New: company and government accounts (PO / PV). |
| `customers.kinds.all` | All customer types | ހުރިހާ ބާވަތެއް | needs_review | New: company and government accounts (PO / PV). |
| `customers.kinds.company` | Company | ކުންފުނި | needs_review | New: company and government accounts (PO / PV). |
| `customers.kinds.government` | Government office | ސަރުކާރު އޮފީސް | needs_review | New: company and government accounts (PO / PV). |
| `customers.kinds.person` | Person | ފަރުދެއް | needs_review | New: company and government accounts (PO / PV). |
| `customers.org_name` | Name of company or office | ކުންފުނީގެ ނުވަތަ އޮފީހުގެ ނަން | needs_review | New: company and government accounts (PO / PV). |
| `documents.add_customer_ref` | Add PO number | ޕީއޯ ނަންބަރު އިތުރުކުރައްވާ | needs_review | New: company and government accounts (PO / PV). |
| `documents.customer_ref` | PO / reference no. | ޕީއޯ / ރެފަރެންސް ނަންބަރު | needs_review | New: company and government accounts (PO / PV). |
| `documents.customer_ref_hint` | The customer's purchase order or tender number. | ކަސްޓަމަރުގެ ޕަރޗޭސް އޯޑަރު ނުވަތަ ޓެންޑަރ ނަންބަރު. | needs_review | New: company and government accounts (PO / PV). |
| `documents.server_totals_hint` | Totals are recalculated by the server when you save. | ސޭވްކުރާއިރު ޖުމްލަތައް ސާވަރުން އަލުން ހިސާބުކުރާނެ. | needs_review | Technical note mentioning the server (ސާވަރު, as in existing settings.hints.tax). |
| `errors.payroll_period_exists` | A salary sheet for this month already exists. | މި މަހުގެ މުސާރަ ޝީޓެއް ކުރިން ހަދާފައި އެބައޮތް. | needs_review | Plain translation using existing app terms. |
| `expenses.categories.ingredients` | Ingredients | ކާނާގެ ތަކެތި | needs_review | ކާނާގެ ތަކެތި; see products.types.ingredient. |
| `expenses.payee` | Paid to | ފައިސާ ދިން ފަރާތް | needs_review | Paid to: ފައިސާ ދިން ފަރާތް. |
| `hub.active` | Active | ހިނގަމުންދާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.add_line` | Add line | ލައިނެއް އިތުރުކުރޭ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.add_task` | Add | އިތުރުކުރޭ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.add_task_placeholder` | Add a task and press Enter | ކަމެއް ލިޔެ Enter ފިތާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.add_update` | Write an update… | އަޕްޑޭޓެއް ލިޔޭ… | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.all` | All | ހުރިހާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.all_tasks` | Everyone's tasks | ހުރިހާ ކަންތައްތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.amount` | Amount | އަދަދު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.amount_due` | Amount due | ދައްކަންޖެހޭ ފައިސާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.assigned_to` | Assigned to | ހަވާލުކުރެވިފައިވާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.balance` | Balance | ބާކީ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.categories.design` | Design | ޑިޒައިން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.categories.hardware` | Hardware | ހާޑްވެއަރ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.categories.it_support` | IT support | އައިޓީ ސަޕޯޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.categories.marketing` | Marketing | މާކެޓިންގ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.categories.other` | Other | އެހެނިހެން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.categories.pos` | POS | ޕީއޯއެސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.categories.software` | Software | ސޮފްޓްވެއަރ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.categories.websites` | Websites | ވެބްސައިޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.category` | Category | ބާވަތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.channel` | Came in by | ކޮންގޮތަކުން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.channels.email` | Email | އީމެއިލް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.channels.other` | Other | އެހެނިހެން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.channels.phone` | Phone | ފޯނު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.channels.social` | Social media | ސޯޝަލް މީޑިއާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.channels.visit` | Visit | ޒިޔާރަތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.choose_client` | Choose a client | ކްލައިންޓެއް ޚިޔާރުކުރޭ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.client` | Client | ކްލައިންޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.client_kind` | Type | ބާވަތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.client_kinds.company` | Company | ކުންފުނި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.client_kinds.government` | Government / council | ސަރުކާރު / ކައުންސިލް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.client_kinds.person` | Person | ފަރުދެއް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.clients` | Clients | ކްލައިންޓުން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.clients_subtitle` | Everyone we work for: POS customers, website clients and more. | އަޅުގަނޑުމެން މަސައްކަތްކޮށްދޭ ހުރިހާ ފަރާތެއް: ޕީއޯއެސް، ވެބްސައިޓް އަދި އެހެނިހެން. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.company` | Company | ކުންފުނި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.convert_to_client` | Make client | ކްލައިންޓަކަށް ހަދާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.convert_to_invoice` | Make invoice | އިންވޮއިސްއަކަށް ހަދާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.converted_to_invoice` | Invoice created from the quotation | ކޯޓޭޝަނުން އިންވޮއިސް ހެދިއްޖެ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.delete_client` | Delete client? | ކްލައިންޓް ފުހެލަންތޯ؟ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.delete_client_body` | Clients with quotations or invoices can't be deleted. | ކޯޓޭޝަން ނުވަތަ އިންވޮއިސް ހުރި ކްލައިންޓުން ފުހެލެވޭކަށް ނެތް. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.description` | Description | ތަފްޞީލް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.discount` | Discount | ޑިސްކައުންޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.doc_statuses.accepted` | Accepted | ގަބޫލުކުރި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.doc_statuses.converted` | Invoiced | އިންވޮއިސް ކުރެވިއްޖެ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.doc_statuses.draft` | Draft | ޑްރާފްޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.doc_statuses.issued` | Issued | ނެރިއްޖެ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.doc_statuses.paid` | Paid | ދައްކާފައި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.doc_statuses.partially_paid` | Part paid | ބައެއް ދައްކާފައި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.doc_statuses.rejected` | Rejected | ރިޖެކްޓްކުރި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.doc_statuses.sent` | Sent | ފޮނުވިއްޖެ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.doc_statuses.void` | Void | ބާޠިލް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.due` | Due | ނިންމަންޖެހޭ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.due_date` | Due date | ނިންމަންޖެހޭ ތާރީޚު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.follow_up` | Follow up | ފޮލޯއަޕް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.follow_ups_today` | Follow-ups due | ފޮލޯއަޕް ކުރަންޖެހޭ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.inactive` | Inactive | ހުއްޓާލާފައި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.interest` | Interested in | ޝައުޤުވެރިވާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.interest_details` | What they need | ބޭނުންވާ ކަންތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.interested_in` | Interested in | ޝައުޤުވެރިވާ ޚިދުމަތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.internal` | Internal | އެތެރޭގެ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.invoice` | Invoice | އިންވޮއިސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.invoices` | Invoices | އިންވޮއިސްތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.invoices_subtitle` | What clients owe OceanX, and payments received. | ކްލައިންޓުން OceanX އަށް ދައްކަންޖެހޭ ފައިސާ، އަދި ލިބުނު ފައިސާ. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.issue` | Issue invoice | އިންވޮއިސް ނެރޭ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.items` | Items | އައިޓަމްތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.lead_converted` | Lead is now a client | ލީޑް މިހާރު ކްލައިންޓެއް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.lead_is_client` | This lead is already a client. | މި ލީޑަކީ މިހާރުވެސް ކްލައިންޓެއް. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.lead_statuses.contacted` | Contacted | ގުޅިއްޖެ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.lead_statuses.demo` | Demo | ޑެމޯ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.lead_statuses.lost` | Lost | ގެއްލުނު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.lead_statuses.new` | New | އައު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.lead_statuses.proposal` | Proposal sent | ޕްރޮޕޯސަލް ފޮނުވިއްޖެ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.lead_statuses.won` | Won | ލިބުނު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.lead_tabs.all` | All | ހުރިހާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.lead_tabs.lost` | Lost | ގެއްލުނު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.lead_tabs.open` | Open | ހުޅުވާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.lead_tabs.won` | Won | ލިބުނު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.leads` | Leads | ލީޑްސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.leads_subtitle` | People interested in our services, from social media, calls and walk-ins. | ސޯޝަލް މީޑިއާ، ފޯނު ކޯލް އަދި ސީދާ އަންނަ، ޚިދުމަތަށް ޝައުޤުވެރިވާ މީހުން. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.mark_accepted` | Accepted | ގަބޫލުކުރި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.mark_rejected` | Rejected | ރިޖެކްޓްކުރި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.mark_sent` | Mark sent | ފޮނުވިކަމަށް ބަލާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.method` | Method | ގޮތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.methods.bank_transfer` | Bank transfer | ބޭންކް ޓްރާންސްފަރ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.methods.card` | Card | ކާޑު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.methods.cash` | Cash | ފައިސާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.methods.cheque` | Cheque | ޗެކް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.methods.other` | Other | އެހެނިހެން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.my_tasks` | My tasks | އަހަރެންގެ ކަންތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.clients` | Clients | ކްލައިންޓުން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.group_company` | Company | ކުންފުނި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.group_sales` | Sales | ސޭލްސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.group_work` | Work | މަސައްކަތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.invoices` | Invoices | އިންވޮއިސްތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.leads` | Leads | ލީޑްސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.overview` | Main office | މައި އޮފީސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.projects` | Projects | ޕްރޮޖެކްޓްތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.quotes` | Quotations | ކޯޓޭޝަންތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.services` | Services | ޚިދުމަތްތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.tasks` | Tasks | ކުރަންޖެހޭ ކަންތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.team` | Team | ޓީމް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nav.tickets` | Support tickets | ސަޕޯޓް ޓިކެޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.new_client` | New client | އައު ކްލައިންޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.new_invoice` | New invoice | އައު އިންވޮއިސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.new_lead` | New lead | އައު ލީޑް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.new_project` | New project | އައު ޕްރޮޖެކްޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.new_quote` | New quotation | އައު ކޯޓޭޝަން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.new_service` | New service | އައު ޚިދުމަތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.new_ticket` | New ticket | އައު ޓިކެޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.next_follow_up` | Next follow-up | ދެން ފޮލޯއަޕް ކުރާ ދުވަސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_client` | No client (internal) | ކްލައިންޓެއް ނޫން (އެތެރޭގެ) | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_clients` | No clients yet | އަދި ކްލައިންޓެއް ނެތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_clients_body` | Add a client, or turn a lead into one. | ކްލައިންޓެއް އިތުރުކުރޭ، ނުވަތަ ލީޑެއް ކްލައިންޓަކަށް ހަދާ. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_documents` | Nothing here yet | އަދި އެއްވެސް އެއްޗެއް ނެތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_documents_body` | Create one for a client. Prices come from your services list. | ކްލައިންޓަކަށް ހަދާ. އަގުތައް ލިބޭނީ ޚިދުމަތްތަކުގެ ލިސްޓުން. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_leads` | No leads yet | އަދި ލީޑެއް ނެތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_leads_body` | Add everyone who asks about our services so nobody is forgotten. | ޚިދުމަތާ ބެހޭގޮތުން ސުވާލުކުރާ ކޮންމެ މީހަކު ހިމަނާ، އެއްވެސް މީހަކު ހަނދާން ނައްތާނުލެވޭނެ. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_projects` | No projects | ޕްރޮޖެކްޓެއް ނެތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_projects_body` | Create a project for each job and break it into tasks. | ކޮންމެ މަސައްކަތަކަށް ޕްރޮޖެކްޓެއް ހަދައި، ކަންތައްތަކަށް ބަހާލާ. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_service` | No service | ޚިދުމަތެއް ނޫން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_services` | No services yet | އަދި ޚިދުމަތެއް ނެތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_services_body` | Add what you offer: POS setup, websites, design, marketing, hardware and more. | ދެއްވާ ޚިދުމަތްތައް އިތުރުކުރޭ: ޕީއޯއެސް، ވެބްސައިޓް، ޑިޒައިން، މާކެޓިންގ، ހާޑްވެއަރ އަދި އެހެނިހެން. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_tasks` | No open tasks. | ނުނިމޭ ކަމެއް ނެތް. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_tickets` | No tickets | ޓިކެޓެއް ނެތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.no_tickets_body` | Log calls, messages and visits from customers who need help. | އެހީއަށް ގުޅާ ކަސްޓަމަރުންގެ ގުޅުންތަކާއި މެސެޖުތައް ލިޔެލާ. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.nothing_due` | Nothing due today. | މިއަދު ކުރަންޖެހޭ އެއްވެސް ކަމެއް ނެތް. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.number` | Number | ނަންބަރު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.open_projects` | Open projects | ހުޅުވާ ޕްރޮޖެކްޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.open_tickets` | Open tickets | ހުޅުވާ ޓިކެޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.opened` | Opened | ހުޅުވި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.overview_subtitle` | Everything OceanX does, in one place: sales, work, support and the POS. | OceanX ގެ ހުރިހާ މަސައްކަތެއް އެއް ތަނެއްގައި: ސޭލްސް، މަސައްކަތް، ސަޕޯޓް އަދި ޕީއޯއެސް. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.overview_title` | Welcome, {{name}} | މަރުޙަބާ، {{name}} | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.payment_recorded` | Payment recorded | ފައިސާ ލިޔެވިއްޖެ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.payments` | Payments | ފައިސާ ދެއްކުންތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.pos_business` | POS business | ޕީއޯއެސް ވިޔަފާރި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.pos_business_hint` | Link if this client uses OceanX POS. | މި ކްލައިންޓް OceanX POS ބޭނުންކުރާނަމަ ގުޅާލާ. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.post_update` | Post | ފޮނުވާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.price` | Price | އަގު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.print_pdf` | Print / PDF | ޕްރިންޓް / PDF | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.priorities.high` | High | މަތި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.priorities.low` | Low | ދަށް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.priorities.normal` | Normal | އާދައިގެ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.priorities.urgent` | Urgent | އަވަސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.priority` | Priority | މުހިންމުކަން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.project` | Project | ޕްރޮޖެކްޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.project_statuses.cancelled` | Cancelled | ކެންސަލް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.project_statuses.done` | Done | ނިމިފައި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.project_statuses.in_progress` | In progress | ހިނގަމުންދާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.project_statuses.planned` | Planned | ރާވާފައި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.project_statuses.review` | In review | ރިވިއު ކުރަނީ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.project_tabs.active` | In progress | ހިނގަމުންދާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.project_tabs.all` | All | ހުރިހާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.project_tabs.done` | Done | ނިމިފައި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.project_title` | Project name | ޕްރޮޖެކްޓްގެ ނަން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.projects` | Projects | ޕްރޮޖެކްޓްތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.projects_subtitle` | Jobs we are delivering: installs, websites, designs and campaigns. | ހިންގަމުންދާ މަސައްކަތްތައް: އިންސްޓޯލޭޝަން، ވެބްސައިޓް، ޑިޒައިން އަދި ކެމްޕެއިން. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.qty` | Qty | އަދަދު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.quote` | Quotation | ކޯޓޭޝަން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.quotes` | Quotations | ކޯޓޭޝަންތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.quotes_subtitle` | Price offers we send to clients. | ކްލައިންޓުންނަށް ފޮނުވާ އަގު ހުށަހެޅުންތައް. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.record_payment` | Record payment | ފައިސާ ލިބުނުކަން ލިޔޭ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.reference` | Reference | ރެފަރެންސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.search_clients` | Search clients | ކްލައިންޓުން ހޯދާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.search_leads` | Search name, company, phone or email | ނަން، ކުންފުނި، ފޯނު ނުވަތަ އީމެއިލް ހޯދާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.search_tickets` | Search tickets | ޓިކެޓް ހޯދާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.service` | Service | ޚިދުމަތް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.services` | Services | ޚިދުމަތްތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.services_subtitle` | What OceanX sells, with standard prices for quotations. | OceanX ވިއްކާ ޚިދުމަތްތަކާއި، ކޯޓޭޝަނަށް ބޭނުންކުރާ އަގުތައް. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.settings.company_hint` | Printed on OceanX quotations and invoices. Bank details below are printed too. | OceanX ގެ ކޯޓޭޝަނާއި އިންވޮއިސްގައި ޕްރިންޓްވާނެ. ތިރީގައިވާ ބޭންކް މަޢުލޫމާތުވެސް ޕްރިންޓްވާނެ. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.settings.company_section` | OceanX company details | OceanX ކުންފުނީގެ މަޢުލޫމާތު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.settings.terms` | Default terms | ޑިފޯލްޓް ޝަރުތުތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.settings.terms_hint` | Added to new quotations and invoices. | އައު ކޯޓޭޝަނާއި އިންވޮއިސްއަށް އެކުލެވޭނެ. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.source` | Source | ކޮންތާކުން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.sources.email` | Email | އީމެއިލް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.sources.other` | Other | އެހެނިހެން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.sources.phone` | Phone call | ފޯނު ކޯލް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.sources.referral` | Referral | ރިފަރަލް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.sources.walk_in` | Walk-in | ސީދާ އައި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.sources.website` | Website | ވެބްސައިޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.start_date` | Start date | ފަށާ ތާރީޚު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_clients` | Clients | ކްލައިންޓުން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_due` | Money owed to us | އަޅުގަނޑުމެންނަށް ލިބެންޖެހޭ ފައިސާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_follow_ups_one` | {{count}} follow-up due | {{count}} ފޮލޯއަޕް ކުރަން ޖެހޭ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_follow_ups_other` | {{count}} follow-ups due | {{count}} ފޮލޯއަޕް ކުރަން ޖެހޭ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_leads` | Open leads | ހުޅުވާ ލީޑްސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_my_tasks` | My open tasks | އަހަރެންގެ ނުނިމޭ ކަންތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_pos` | Active POS businesses | ހިނގަމުންދާ ޕީއޯއެސް ވިޔަފާރި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_pos_pending_one` | {{count}} payment to check | {{count}} ފައިސާ ޗެކްކުރަން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_pos_pending_other` | {{count}} payments to check | {{count}} ފައިސާ ޗެކްކުރަން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_projects` | Active projects | ހިނގަމުންދާ ޕްރޮޖެކްޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_received` | Received this month | މި މަހު ލިބުނު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_team_tasks_one` | {{count}} open for the team | ޓީމަށް {{count}} ކަންތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_team_tasks_other` | {{count}} open for the team | ޓީމަށް {{count}} ކަންތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_tickets` | Open tickets | ހުޅުވާ ޓިކެޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_unpaid_invoices_one` | {{count}} unpaid invoice | {{count}} ނުދައްކާ އިންވޮއިސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_unpaid_invoices_other` | {{count}} unpaid invoices | {{count}} ނުދައްކާ އިންވޮއިސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_urgent_one` | {{count}} urgent | {{count}} އަވަސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.stat_urgent_other` | {{count}} urgent | {{count}} އަވަސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.subject` | Subject | މައުޟޫޢު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.subtotal` | Subtotal | ސަބް ޓޯޓަލް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.tasks` | Tasks | ކުރަންޖެހޭ ކަންތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.tasks_subtitle` | Your to-do list and the team's. | ތިބާގެ އަދި ޓީމުގެ ކުރަންޖެހޭ ކަންތައް. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.tax_number` | Tax number (TIN) | ޓެކްސް ނަންބަރު (TIN) | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.ticket` | Ticket | ޓިކެޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.ticket_statuses.closed` | Closed | ބަންދު | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.ticket_statuses.in_progress` | Working on it | މަސައްކަތްކުރަމުން | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.ticket_statuses.open` | Open | ހުޅުވާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.ticket_statuses.resolved` | Resolved | ހައްލުކުރެވިއްޖެ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.ticket_statuses.waiting` | Waiting on customer | ކަސްޓަމަރަށް އިންތިޒާރުކުރަނީ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.ticket_tabs.all` | All | ހުރިހާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.ticket_tabs.open_all` | Open | ހުޅުވާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.ticket_tabs.resolved` | Resolved | ހައްލުކުރެވިފައި | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.tickets` | Support tickets | ސަޕޯޓް ޓިކެޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.tickets_subtitle` | Customer problems and requests, until they are solved. | ކަސްޓަމަރުންގެ މައްސަލަތަކާއި އެދުންތައް، ހައްލުވާންދެން. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.tip_add_services` | Tip: add your services first to fill prices in one tap. | ޓިޕް: އެއް ފިތުމުން އަގު ލިބޭނެގޮތަށް ފުރަތަމަ ޚިދުމަތްތައް އިތުރުކުރޭ. | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.total` | Total | ޖުމްލަ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.unassigned` | Unassigned | ހަވާލުނުކުރެވޭ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.unit` | Unit | ޔުނިޓް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.unit_hint` | e.g. job, month, hour, page | މިސާލު: މަސައްކަތް، މަސް، ގަޑިއިރު، ޞަފްޙާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.unpaid` | Unpaid | ނުދައްކާ | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.updates` | Updates | އަޕްޑޭޓްތައް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.valid_until` | Valid until | މުއްދަތު ހަމަވާ ދުވަސް | needs_review | New: OceanX Hub (Super Admin main office). |
| `hub.value` | Value | އަގު | needs_review | New: OceanX Hub (Super Admin main office). |
| `inventory.add_shop_product` | Add product | ތަކެތި އިތުރުކުރޭ | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.add_shop_product_hint` | A product for sale, with its stock in the store and on the rack. | ވިއްކާ ތަކެތި، ސްޓޯރާއި ރެކުގައި ހުރި ސްޓޮކާއެކު. | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.add_supply` | Add stock item | ސްޓޮކް އައިޓަމެއް އިތުރުކުރޭ | needs_review | Loanwords ސްޓޮކް/އައިޓަމް follow existing inventory strings. Alternative: ސްޓޮކަށް ތަކެއްޗެއް އިތުރުކުރޭ. |
| `inventory.add_supply_hint` | For things you use but don't sell, like a milk powder packet, cups or syrup. Tracked in stock, hidden from the POS. | ބޭނުންކުރާ ނަމަވެސް ނުވިއްކާ ތަކެތި، މިސާލަކަށް މިލްކް ޕައުޑަރު ޕެކެޓެއް، ކަޕު ނުވަތަ ސިރަޕް. ސްޓޮކުގައި ބަލަހައްޓާނެ، POSގައި ނުފެންނާނެ. | needs_review | Milk powder and cups rendered as loanwords (މިލްކް ޕައުޑަރު, ކަޕު); confirm local café usage (e.g. ކިރުގަނޑު). |
| `inventory.adjust` | Adjust stock | ސްޓޮކް އެޑްޖަސްޓްކުރޭ | needs_review | Loanword ސްޓޮކް އެޑްޖަސްޓްކުރޭ follows existing perm.inventory_adjust. Native alternative: ސްޓޮކް ރަނގަޅުކުރޭ. |
| `inventory.alert_at` | Alert at {{n}} | {{n}} ގައި އެލާޓް | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.barcode` | Barcode / SKU | ބާކޯޑް / އެސްކޭޔޫ | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.barcode_hint` | Scan the product barcode into this box. | މި ބޮކްސަށް ތަކެއްޗުގެ ބާކޯޑް ސްކޭން ކުރައްވާ. | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.case_count_one` | {{count}} case | {{count}} ކޭސް | needs_review | New: shop store stock in cases. |
| `inventory.case_count_other` | {{count}} cases | {{count}} ކޭސް | needs_review | New: shop store stock in cases. |
| `inventory.cases` | Cases | ކޭސް | needs_review | New: shop store stock in cases. |
| `inventory.cases_of` | Cases of {{n}} | {{n}} ގެ ކޭސް | needs_review | New: shop store stock in cases. |
| `inventory.cases_to_open` | Cases to open | ހުޅުވާ ކޭސް | needs_review | New: shop store stock in cases. |
| `inventory.in_store` | In store | ސްޓޯރުގައި | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.kinds.supplies` | Ingredients & supplies | ތަކެތި އަދި ސަޕްލައިސް | needs_review | ތަކެތި for ingredients matches products.add_ingredient; ސަޕްލައިސް is a loanword. |
| `inventory.location` | Where | ހުރި ތަން | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.loose_pieces` | Loose {{unit}} | ލޫސް {{unit}} | needs_review | New: shop store stock in cases. |
| `inventory.low_in_store` | Low in store | ސްޓޯރުގައި މަދު | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.low_on_rack` | Low on rack | ރެކުގައި މަދު | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.modes.set` | Set counted quantity | ގުނި އަދަދު ސެޓްކުރޭ | needs_review | 'Set counted quantity' — ގުނި އަދަދު ސެޓްކުރޭ; confirm. |
| `inventory.modes.wastage` | Record wastage | ގެއްލުނު / ހަލާކުވި ތަކެތި ރެކޯޑުކުރޭ | needs_review | Wastage rendered as ގެއްލުނު / ހަލާކުވި ތަކެތި (lost/spoiled). Alternative loanword: ވޭސްޓޭޖް. Also inventory.types.wastage. |
| `inventory.on_rack` | On rack | ރެކުގައި | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.opening_rack` | Stock on rack now | މިހާރު ރެކުގައި ހުރި ސްޓޮކް | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.opening_store` | Stock in store now | މިހާރު ސްޓޯރުގައި ހުރި ސްޓޮކް | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.pack_size` | Pieces per case | ކޭހެއްގައި ހުންނަ އަދަދު | needs_review | New: shop store stock in cases. |
| `inventory.pack_size_hint` | Store stock is counted in cases. Use 1 if it comes loose. | ސްޓޯރުގެ ސްޓޮކް ގުނަނީ ކޭހުން. ލޫހަށް އަންނަ ނަމަ 1 ޖައްސަވާ. | needs_review | New: shop store stock in cases. |
| `inventory.per_case` | Cost per case | ކޭހަކަށް ޚަރަދު | needs_review | New: shop store stock in cases. |
| `inventory.per_case_hint` | {{n}} {{unit}} per case | ކޭހެއްގައި {{n}} {{unit}} | needs_review | New: shop store stock in cases. |
| `inventory.rack_alert` | Rack alert level | ރެކުގެ އެލާޓް ލެވެލް | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.rack_alert_hint` | Alert when this many or fewer are left on the rack (e.g. 5). | ރެކުގައި މިހާ އަދަދަކަށް ނުވަތަ މަދުވުމުން އެލާޓް (މިސާލު 5). | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.refill` | Refill rack | ރެކު ފުރާ | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.refill_hint` | Moves goods from the store to the rack. The store goes down by the same amount. | ސްޓޯރުން ތަކެތި ރެކަށް ބަދަލުކުރޭ. ސްޓޯރުން އެހައި އަދަދެއް މަދުވާނެ. | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.refill_qty` | Quantity to put on the rack | ރެކަށް ލާ އަދަދު | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.refill_result` | After this: {{rack}} on rack, {{store}} in store | މީގެ ފަހުން: ރެކުގައި {{rack}}، ސްޓޯރުގައި {{store}} | needs_review | New: shop store stock in cases. |
| `inventory.refill_title` | Refill the rack from the store | ސްޓޯރުން ރެކު ފުރުން | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.refilled` | Rack refilled: {{shop}} {{unit}} on rack, {{store}} {{unit}} left in store | ރެކު ފުރިއްޖެ: ރެކުގައި {{shop}} {{unit}}، ސްޓޯރުގައި {{store}} {{unit}} ބާކީ | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.refilled_cases` | Rack refilled: {{shop}} on rack, {{store}} left in store | ރެކު ފުރިއްޖެ: ރެކުގައި {{shop}}، ސްޓޯރުގައި {{store}} ބާކީ | needs_review | New: shop store stock in cases. |
| `inventory.store_alert` | Store alert level | ސްޓޯރުގެ އެލާޓް ލެވެލް | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.store_alert_cases` | Store alert level (cases) | ސްޓޯރުގެ އެލާޓް (ކޭސް) | needs_review | New: shop store stock in cases. |
| `inventory.store_alert_hint` | Time to reorder from the supplier when the store gets this low. | ސްޓޯރުގައި މިހާ މަދުވުމުން ސަޕްލަޔަރުން އަލުން ގަންނަ ވަގުތު. | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.store_alert_pcs` | Store alert level (pieces) | ސްޓޯރުގެ އެލާޓް (އަދަދު) | needs_review | New: shop store stock in cases. |
| `inventory.total_paid` | Total paid | ޖުމްލަ ދެއްކި | needs_review | New: enter total paid for bulk stock purchases. |
| `inventory.total_paid_hint` | For a bulk buy: what you paid for the whole opening stock. The cost per unit is worked out. | ގިނައިން ގަތުމުގައި: ފުރަތަމަ ސްޓޮކު ހުރިހާ އެއްޗަކަށް ދެއްކި އަދަދު. އެއްޗަކަށް ވާ އަގު ހިސާބުކުރެވޭނެ. | needs_review | New: enter total paid for bulk stock purchases. |
| `inventory.transfer` | Transfer | ޓްރާންސްފަރ | needs_review | Loanword ޓްރާންސްފަރ, from existing addons.descriptions.advanced_inventory. Native alternative: ބަދަލުކުރުން. |
| `inventory.types.refill` | Rack refill | ރެކު ފުރުން | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `inventory.types.transfer_in` | Transfer in | ޓްރާންސްފަރ (ލިބުނު) | needs_review | Rendered with parenthetical (ލިބުނު); alternative: ވަދެފައިވާ ޓްރާންސްފަރ. |
| `inventory.types.wastage` | Wastage | ގެއްލުނު / ހަލާކުވި | needs_review | See inventory.modes.wastage. |
| `invoices.issue` | Issue invoice | އިންވޮއިސް ނެރޭ | needs_review | 'Issue invoice' as އިންވޮއިސް ނެރޭ (lit. 'release/publish'). Alternatives: އިންވޮއިސް ފައިނަލްކުރޭ, އިޝޫކުރޭ. Also status_labels.issued (ނެރެފައި), documents.actions_done.issue, activity.actions.invoice_issued, documents.confirm.issue_title. |
| `menu_i18n.description_in` | Description in {{language}} | {{language}} ބަހުން ތަފްޞީލު | needs_review | New: labels for item names in other languages. |
| `menu_i18n.hint` | Shown on the QR menu when a customer picks this language. Leave empty to show the main name. | ކަސްޓަމަރަކު މި ބަސް ޚިޔާރުކުރުމުން ކިއުއާރް މެނޫގައި ފެންނާނީ މިއެވެ. ހުސްކޮށް ބަހައްޓައިފިނަމަ މައި ނަން ފެންނާނެއެވެ. | needs_review | New: labels for item names in other languages. |
| `menu_i18n.message_in` | Welcome message in {{language}} | {{language}} ބަހުން މަރުޙަބާ މެސެޖު | needs_review | New: labels for item names in other languages. |
| `menu_i18n.more_languages` | More languages | އިތުރު ބަސްތައް | needs_review | New: labels for item names in other languages. |
| `menu_i18n.name_in` | Name in {{language}} | {{language}} ބަހުން ނަން | needs_review | New: labels for item names in other languages. |
| `modules.purchases` | Purchases | ގަތުން | needs_review | Alternative loanword: ޕާޗޭސް. |
| `nav.billing` | Billing | ބިލިންގ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `nav.group_catalog_retail` | Products & stock | ތަކެތިއާއި ސްޓޮކް | needs_review | New: retail shops menu section. |
| `nav.group_staff` | Staff | ސްޓާފުން | needs_review | Plain translation using existing app terms. |
| `nav.payroll` | Salary sheets | މުސާރަ ޝީޓްތައް | needs_review | "Salary sheet" = މުސާރަ ޝީޓް (މުސާރަ from expenses.categories.salaries). Alternative: މުސާރަ ލިސްޓު. |
| `nav.products` | Products | ތަކެތި | needs_review | New: retail shops (stock check, barcode). |
| `nav.rota` | Duty rota | ޑިއުޓީ ރޯސްޓަރު | needs_review | "Rota" rendered as ޑިއުޓީ ރޯސްޓަރު (loanword). Alternatives: ޑިއުޓީ ލިސްޓު, ޑިއުޓީ ޝެޑިއުލް. |
| `nav.stock_check` | Stock check | ސްޓޮކް ބެލުން | needs_review | New: retail shops (stock check, barcode). |
| `notify.low_on_rack` | Low on rack: {{product}} ({{quantity}} left on rack, {{store}} in store) | ރެކުގައި މަދު: {{product}} (ރެކުގައި {{quantity}} ބާކީ، ސްޓޯރުގައި {{store}}) | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `onboarding.steps_retail.categories` | Create product categories | ތަކެތީގެ ކެޓަގަރީތައް ހަދާ | needs_review | New/updated: shops on the platform. |
| `onboarding.steps_retail.categories_hint` | e.g. Groceries, Drinks, Household. | މިސާލު: ގްރޮސަރީ، ބުއިން، ގޭބިސީ ތަކެތި. | needs_review | New/updated: shops on the platform. |
| `onboarding.steps_retail.products` | Add your products | ތަކެތި އިތުރުކުރައްވާ | needs_review | New/updated: shops on the platform. |
| `onboarding.steps_retail.products_hint` | Barcode, price and stock in store and on rack. | ބާކޯޑް، އަގު، އަދި ސްޓޯރާއި ރެކުގެ ސްޓޮކް. | needs_review | New/updated: shops on the platform. |
| `onboarding.title` | Get set up | ސެޓްއަޕް ކުރައްވާ | needs_review | 'Get set up' → ސެޓްއަޕް ކުރައްވާ. |
| `payments.reference_pv_hint` | Payment voucher (PV), cheque or transfer number. | ޕޭމަންޓް ވައުޗަރު (ޕީވީ)، ޗެކު ނުވަތަ ޓްރާންސްފަރ ނަންބަރު. | needs_review | New: company and government accounts (PO / PV). |
| `perm.branding_manage` | Manage the company stamp and document signatures | ކުންފުނީގެ ތައްގަނޑާއި ލިޔެކިޔުންތަކުގެ ސޮއި ބެލެހެއްޓުން | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `perm.credit_create` | Make credit sales | ދަރަންޏަށް ވިއްކާ | needs_review | Depends on the credit terminology decision above. |
| `perm.credit_view` | View customer due | ކަސްޓަމަރުންގެ ދަރަނި ބަލާ | needs_review | Depends on the credit terminology decision above. |
| `perm.loyalty_view` | View loyalty points | ލޮޔަލްޓީ ޕޮއިންޓް ބަލާ | needs_review | ލޮޔަލްޓީ ޕޮއިންޓް — consistent with existing addons.names.loyalty. Native alternative not common. |
| `perm.payroll_manage` | Make and finalize salary sheets | މުސާރަ ޝީޓް ހަދައި ފައިނަލްކުރޭ | needs_review | "Finalize" rendered as loanword ފައިނަލްކުރޭ. Alternative: ނިންމާ / ކަށަވަރުކުރޭ. |
| `perm.payroll_view` | View salary sheets and salaries | މުސާރަ ޝީޓްތަކާއި މުސާރަ ބަލާ | needs_review | Plain translation using existing app terms. |
| `perm.rota_manage` | Edit the duty rota and shifts | ޑިއުޓީ ރޯސްޓަރާއި ޝިފްޓުތައް ބަދަލުކުރޭ | needs_review | "Shift" = ޝިފްޓު (loanword). |
| `perm.rota_view` | View the duty rota | ޑިއުޓީ ރޯސްޓަރު ބަލާ | needs_review | Plain translation using existing app terms. |
| `pos.only_left_on_rack_one` | Only {{count}} {{name}} left on the rack. | ރެކުގައި {{name}} ހުރީ {{count}} އެކަނި. | needs_review | New: shops cannot sell more than is on the rack. |
| `pos.only_left_on_rack_other` | Only {{count}} {{name}} left on the rack. | ރެކުގައި {{name}} ހުރީ {{count}} އެކަނި. | needs_review | New: shops cannot sell more than is on the rack. |
| `pos.open_credit` | Allow pay later (credit) | ފަހުން ފައިސާ ދެއްކުމުގެ ހުއްދަ (ކްރެޑިޓް) | needs_review | New: open a pay-later account from the POS. |
| `pos.open_credit_hint` | Opens a credit account so this customer can buy now and pay later. | މި ކަސްޓަމަރަށް މިހާރު ގަނެ ފަހުން ފައިސާ ދެއްކޭނެ ގޮތަށް ކްރެޑިޓް އެކައުންޓެއް ހުޅުވޭނެ. | needs_review | New: open a pay-later account from the POS. |
| `pos.order_types.in_store` | In store | ފިހާރައިން | needs_review | New: retail shops (stock check, barcode). |
| `pos.out_on_rack` | {{name}} is out of stock on the rack. | {{name}} ރެކުގައި ނެތް. | needs_review | New: shops cannot sell more than is on the rack. |
| `pos.search_retail` | Scan barcode or search… | ބާކޯޑް ސްކޭން ކުރައްވާ ނުވަތަ ހޯއްދަވާ… | needs_review | New: retail shops (stock check, barcode). |
| `print.authorized_signature` | Authorized signature | ހުއްދަދީފައިވާ ފަރާތުގެ ސޮއި | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `print.customer_ref` | PO No. | ޕީއޯ ނަންބަރު | needs_review | New: company and government accounts (PO / PV). |
| `print.received_by` | Received by | ބަލައިގަތީ | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `public_menu.menu_title` | Menu | މެނޫ | needs_review | New: dark QR menu design (big title, best-seller badge, items without a category). |
| `public_menu.more` | More | އިތުރު | needs_review | New: dark QR menu design (big title, best-seller badge, items without a category). |
| `public_menu.top` | TOP {{rank}} | ޓޮޕް {{rank}} | needs_review | New: dark QR menu design (big title, best-seller badge, items without a category). |
| `purchases.line_total` | Total paid | ޖުމްލަ ދެއްކި | needs_review | New: enter total paid for bulk stock purchases. |
| `purchases.line_total_hint` | Bought in bulk? Enter the total you paid for the line and the unit cost is worked out for you. | ގިނައިން ގަތީތޯ؟ އެ ލައިނަށް ދެއްކި ޖުމްލަ އަދަދު ލިޔުއްވާ، އެއްޗަކަށް ވާ އަގު އަމިއްލައަށް ހިސާބުކުރެވޭނެ. | needs_review | New: enter total paid for bulk stock purchases. |
| `qr.add_dish` | Add dish | ކާނާއެއް އިތުރުކުރޭ | needs_review | New: QR Menu → Menu items tab. |
| `qr.items_empty_hint` | Add your dishes with a photo and Dhivehi name. They appear on the QR menu right away. | ފޮޓޯއާއި ދިވެހި ނަމާއެކު ކާނާތައް އިތުރުކުރައްވާ. ކިއުއާރް މެނޫގައި ވަގުތުން ފެންނާނެއެވެ. | needs_review | New: QR Menu → Menu items tab. |
| `qr.items_no_dv_one` | {{count}} without a Dhivehi name | ދިވެހި ނަން ނެތް {{count}} | needs_review | New: QR Menu → Menu items tab. |
| `qr.items_no_dv_other` | {{count}} without a Dhivehi name | ދިވެހި ނަން ނެތް {{count}} | needs_review | New: QR Menu → Menu items tab. |
| `qr.items_no_photo_one` | {{count}} without a photo | ފޮޓޯ ނެތް {{count}} | needs_review | New: QR Menu → Menu items tab. |
| `qr.items_no_photo_other` | {{count}} without a photo | ފޮޓޯ ނެތް {{count}} | needs_review | New: QR Menu → Menu items tab. |
| `qr.items_summary_one` | {{count}} dish on the customer menu | ކަސްޓަމަރުންގެ މެނޫގައި {{count}} ކާނާ | needs_review | New: QR Menu → Menu items tab. |
| `qr.items_summary_other` | {{count}} dishes on the customer menu | ކަސްޓަމަރުންގެ މެނޫގައި {{count}} ކާނާ | needs_review | New: QR Menu → Menu items tab. |
| `qr.move_down` | Move down | ތިރިއަށް | needs_review | New: QR Menu → Menu items tab. |
| `qr.move_up` | Move up | މައްޗަށް | needs_review | New: QR Menu → Menu items tab. |
| `qr.no_dv_name` | No Dhivehi name yet | އަދި ދިވެހި ނަމެއް ނެތް | needs_review | New: QR Menu → Menu items tab. |
| `qr.tab_items` | Menu items | މެނޫގެ އައިޓަމްތައް | needs_review | New: QR Menu → Menu items tab. |
| `qr.tab_settings` | QR code & settings | ކިއުއާރް ކޯޑާއި ސެޓިންގްސް | needs_review | New: QR Menu → Menu items tab. |
| `quotations.convert` | Convert to invoice | އިންވޮއިސްއަކަށް ބަދަލުކުރޭ | needs_review | އިންވޮއިސްއަކަށް ބަދަލުކުރޭ follows existing perm.quotations_convert_to_invoice. |
| `reports.columns.average` | Average per order | އޯޑަރަކަށް އެވްރެޖް | needs_review | Was "Average"; now says it is the average bill per order. |
| `reports.columns.cases` | Cases | ކޭސް | needs_review | New: shop store stock in cases. |
| `reports.columns.gross` | Gross | ގްރޮސް | needs_review | Loanword ގްރޮސް; alternative: ޖުމްލަ (ޑިސްކައުންޓް ކުރިން). |
| `reports.columns.in_store` | In store | ސްޓޯރުގައި | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `reports.columns.margin` | Margin | މާޖިން | needs_review | Loanword މާޖިން. Alternative: ފައިދާގެ މިންވަރު. |
| `reports.columns.on_rack` | On rack | ރެކުގައި | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `reports.columns.per_case` | Per case | ކޭހަކަށް | needs_review | New: shop store stock in cases. |
| `reports.columns.rack_alert_at` | Rack alert at | ރެކު އެލާޓް | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `reports.columns.store_alert_at` | Store alert at | ސްޓޯރު އެލާޓް | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `reports.export_csv` | Export CSV | CSV އެކްސްޕޯޓްކުރޭ | needs_review | ސީއެސްވީ transliteration. |
| `reports.rows_count_other` | {{count}} rows | {{count}} ރޯ | needs_review | Loanword ރޯ (row). Dhivehi has no plural inflection after numerals; alternative: {{count}} ލައިން. |
| `reports.summary.cogs` | Cost of goods | ވިއްކި ތަކެތީގެ ކޮސްޓް | needs_review | Cost of goods: ވިއްކި ތަކެތީގެ ކޮސްޓް. Confirm with accountant. |
| `reports.summary.grossProfit` | Gross profit | ގްރޮސް ފައިދާ | needs_review | ގްރޮސް ފައިދާ (mixed loanword). Alternative: ޚަރަދު ކުރިން ފައިދާ. |
| `reports.summary.netProfit` | Net profit | ނެޓް ފައިދާ | needs_review | ނެޓް ފައިދާ. Alternative: ޞާފު ފައިދާ. |
| `reports.types.costing` | Recipe costing | ރެސިޕީގެ ޚަރަދު | needs_review | Recipe costing as ރެސިޕީގެ ޚަރަދު. Existing addons.names.ingredient_costing uses ތަކެތީގެ ޚަރަދު ހިސާބުކުރުން. Note: report columns use loanword ކޮސްޓް for cost of goods while ޚަރަދު is reserved for expenses — confirm this split. |
| `reports.types.profit` | Profit & loss | ފައިދާއާއި ގެއްލުން | needs_review | Profit & loss: ފައިދާއާއި ގެއްލުން — standard phrase, but please confirm. |
| `reports.types.rack-low` | Low on rack | ރެކުގައި މަދު | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `reports.types.store-stock` | Store stock | ސްޓޯރު ސްޓޮކް | needs_review | New: shops — rack (ރެކު) vs store (ސްޓޯރު) stock. |
| `roles.system_desc_retail.business_admin` | Full control of the shop. | ފިހާރައިގެ ފުރިހަމަ ކޮންޓްރޯލް. | needs_review | New/updated: shops on the platform. |
| `roles.system_desc_retail.cashier` | Sells at the counter, checks stock, serves customers and makes quotations and invoices. | ކައުންޓަރުގައި ވިއްކައި، ސްޓޮކް ބަލައި، ކަސްޓަމަރުންނަށް ޚިދުމަތްދީ، ކޯޓޭޝަނާއި އިންވޮއިސް ހަދާ. | needs_review | New/updated: shops on the platform. |
| `roles.system_retail.business_admin` | Owner | ވެރިފަރާތް | needs_review | New/updated: shops on the platform. |
| `roles.system_retail.cashier` | Cashier / Salesperson | ކޭޝިއަރ / ވިއްކާ މީހާ | needs_review | New/updated: shops on the platform. |
| `settings.hints.branding` | Your company stamp and whether documents show the stamp and signatures. | ކުންފުނީގެ ތައްގަނޑާއި، ލިޔެކިޔުންތަކުގައި ތައްގަނޑާއި ސޮއި ދައްކާނެ ގޮތް. | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `settings.hints.pos` | How the point of sale behaves. | ޕޮއިންޓް އޮފް ސޭލް ހިނގާނެ ގޮތް. | needs_review | 'Point of sale' transliterated ޕޮއިންޓް އޮފް ސޭލް. Alternative: ވިއްކާ ސިސްޓަމް. |
| `settings.loyalty.points_per_unit` | Points per 1 currency unit spent | ޚަރަދުކުރާ ކޮންމެ 1 ފައިސާ ޔުނިޓަކަށް ލިބޭ ޕޮއިންޓް | needs_review | Long phrasing; check clarity. |
| `settings.pos.allow_negative_stock` | Allow selling when out of stock | ސްޓޮކް ނެތްއިރުވެސް ވިއްކުމުގެ ހުއްދަ | needs_review | Check phrasing: ސްޓޮކް ނެތްއިރުވެސް ވިއްކުމުގެ ހުއްދަ. |
| `settings.tabs.branding` | Stamp & signature | ތައްގަނޑާއި ސޮއި | needs_review | New: stamp and signature on documents. ތައްގަނޑު = stamp/seal; ސޮއި = signature. |
| `staff.active_hint` | Inactive staff are left off new salary sheets and the rota. | އިންއެކްޓިވް ސްޓާފުން އާ މުސާރަ ޝީޓްތަކާއި ރޯސްޓަރުގައި ނުހިމެނޭނެ. | needs_review | Inactive = އިންއެކްޓިވް as in users.account_active_hint; common.inactive uses ހަރަކާތްތެރި ނޫން. |
| `staff.add_missing_staff` | Add missing staff | ނެތް ސްޓާފުން އިތުރުކުރޭ | needs_review | "Missing" = not yet on the sheet; ނެތް ސްޓާފުން may read as "absent staff". Alternative: ހިމެނިފައިނުވާ ސްޓާފުން. |
| `staff.add_shift` | Add shift | ޝިފްޓު އިތުރުކުރޭ | needs_review | Plain translation using existing app terms. |
| `staff.add_staff` | Add staff | ސްޓާފު އިތުރުކުރޭ | needs_review | Plain translation using existing app terms. |
| `staff.add_to_expenses` | Add to expenses as “Salaries” | “މުސާރަ” ގެ ގޮތުގައި ޚަރަދުތަކަށް އިތުރުކުރޭ | needs_review | Plain translation using existing app terms. |
| `staff.add_to_expenses_hint` | Records the total net pay as one expense for this month. | ޖުމްލަ ނެޓް މުސާރަ، މި މަހުގެ އެއް ޚަރަދެއްގެ ގޮތުގައި ރެކޯޑުކުރާނެ. | needs_review | Plain translation using existing app terms. |
| `staff.approved_by` | Approved by | އެޕްރޫވްކުރީ | needs_review | Alternative: ހުއްދަދިނީ. |
| `staff.basic_salary` | Basic salary (monthly) | ބޭސިކް މުސާރަ (މަހަކަށް) | needs_review | "Basic" = ބޭސިކް (loanword common on payslips). Alternative: އަސާސީ މުސާރަ. |
| `staff.basic_salary_hint` | Used as the starting amount on each new salary sheet. | ކޮންމެ އާ މުސާރަ ޝީޓެއްގައި ފުރަތަމަ ލިޔެވޭނީ މި އަދަދު. | needs_review | Plain translation using existing app terms. |
| `staff.col_advance` | Advance | އެޑްވާންސް | needs_review | Plain translation using existing app terms. |
| `staff.col_allowances` | Allowances | އެލަވަންސް | needs_review | Plain translation using existing app terms. |
| `staff.col_basic` | Basic | ބޭސިކް | needs_review | Alternative: އަސާސީ. |
| `staff.col_deductions` | Deductions | ކެނޑުން | needs_review | ކެނޑުން = deductions. Alternative: އުނިކުރުންތައް. |
| `staff.col_net` | Net pay | ނެޓް މުސާރަ | needs_review | Net pay = ނެޓް މުސާރަ (cf. reports.summary.netProfit ނެޓް ފައިދާ). Alternative: ލިބޭ މުސާރަ. |
| `staff.col_overtime` | Overtime | އޯވަޓައިމް | needs_review | Plain translation using existing app terms. |
| `staff.colour` | Colour | ކުލަ | needs_review | Plain translation using existing app terms. |
| `staff.colours.amber` | Yellow | ރީނދޫ | needs_review | Yellow = ރީނދޫ. |
| `staff.colours.emerald` | Green | ފެހި | needs_review | Plain translation using existing app terms. |
| `staff.colours.rose` | Red | ރަތް | needs_review | Plain translation using existing app terms. |
| `staff.colours.sky` | Blue | ނޫ | needs_review | Plain translation using existing app terms. |
| `staff.colours.slate` | Grey | އަޅި | needs_review | Grey = އަޅި(ކުލަ). Alternative: ގްރޭ. |
| `staff.colours.violet` | Purple | ދަނބު | needs_review | Purple = ދަނބު(ކުލަ). Alternative: ވައިލެޓް / ޕާޕަލް. |
| `staff.copied_one` | Copied {{count}} entry from last week | ވޭތުވެދިޔަ ހަފްތާއިން {{count}} އެންޓްރީ ކޮޕީކުރެވިއްޖެ | needs_review | Entry = އެންޓްރީ (loanword). No plural inflection. |
| `staff.copied_other` | Copied {{count}} entries from last week | ވޭތުވެދިޔަ ހަފްތާއިން {{count}} އެންޓްރީ ކޮޕީކުރެވިއްޖެ | needs_review | Same as _one. |
| `staff.copy_last_week` | Copy last week | ވޭތުވެދިޔަ ހަފްތާ ކޮޕީކުރޭ | needs_review | Plain translation using existing app terms. |
| `staff.copy_last_week_body` | This week will be replaced with a copy of last week’s rota. | މި ހަފްތާގެ ބަދަލުގައި ވޭތުވެދިޔަ ހަފްތާގެ ރޯސްޓަރުގެ ކޮޕީއެއް ލެވޭނެ. | needs_review | Plain translation using existing app terms. |
| `staff.create_sheet` | Create sheet | ޝީޓް ހަދާ | needs_review | Plain translation using existing app terms. |
| `staff.day_off` | Off | އޯފް | needs_review | "Off" = day off, written as loanword އޯފް (common in workplaces). Alternative: ބަންދު / ބަންދު ދުވަސް. |
| `staff.delete_sheet` | Delete sheet | ޝީޓް ޑިލީޓްކުރޭ | needs_review | Delete = ޑިލީޓް as in common.delete (perm.* uses ފޮހެލާ). |
| `staff.delete_sheet_body` | This draft salary sheet will be deleted. | މި ޑްރާފްޓް މުސާރަ ޝީޓް ޑިލީޓްކުރެވޭނެ. | needs_review | Plain translation using existing app terms. |
| `staff.download_payslip` | Download payslip PDF for {{name}} | {{name}} ގެ މުސާރަ ސްލިޕް PDF ޑައުންލޯޑްކުރޭ | needs_review | New: individual payslips. ސްލިޕް = slip. |
| `staff.earnings` | Earnings | ލިބޭ ފައިސާ | needs_review | New: individual payslips. ސްލިޕް = slip. |
| `staff.edit_shift` | Edit shift | ޝިފްޓު ބަދަލުކުރޭ | needs_review | Plain translation using existing app terms. |
| `staff.edit_staff` | Edit staff | ސްޓާފު ބަދަލުކުރޭ | needs_review | Plain translation using existing app terms. |
| `staff.employee_signature` | Employee signature | މުވައްޒަފުގެ ސޮއި | needs_review | New: individual payslips. ސްލިޕް = slip. |
| `staff.end_time` | Ends | ނިމޭ ގަޑި | needs_review | Literal "end time". |
| `staff.finalize` | Finalize | ފައިނަލްކުރޭ | needs_review | Plain translation using existing app terms. |
| `staff.finalize_body` | Finalizing locks the sheet. You can reopen it later if something needs correcting. | ފައިނަލްކުރުމުން ޝީޓް ލޮކްވާނެ. އިސްލާހުކުރަން ޖެހިއްޖެނަމަ ފަހުން އަލުން ހުޅުވިދާނެ. | needs_review | Lock = ލޮކް (loanword). |
| `staff.finalized_hint` | This sheet is finalized and locked. | މި ޝީޓް ފައިނަލްކޮށް ލޮކްކޮށްފައި. | needs_review | Plain translation using existing app terms. |
| `staff.finalized_toast` | Salary sheet finalized | މުސާރަ ޝީޓް ފައިނަލްކުރެވިއްޖެ | needs_review | Plain translation using existing app terms. |
| `staff.finalized_with_expense` | This sheet is finalized and locked. The total was added to expenses as Salaries. | މި ޝީޓް ފައިނަލްކޮށް ލޮކްކޮށްފައި. ޖުމްލަ އަދަދު މުސާރައިގެ ގޮތުގައި ޚަރަދުތަކަށް އިތުރުކުރެވިފައި. | needs_review | Plain translation using existing app terms. |
| `staff.gross_pay` | Gross pay | ޖުމްލަ މުސާރަ | needs_review | New: individual payslips. ސްލިޕް = slip. |
| `staff.leave` | Leave | ޗުއްޓީ | needs_review | ޗުއްޓީ = leave (holiday/sick). |
| `staff.month` | Month | މަސް | needs_review | Plain translation using existing app terms. |
| `staff.net_formula` | Net pay = basic + allowances + overtime − deductions − advance. | ނެޓް މުސާރަ = ބޭސިކް + އެލަވަންސް + އޯވަޓައިމް − ކެނޑުން − އެޑްވާންސް. | needs_review | Plain translation using existing app terms. |
| `staff.new_sheet` | New salary sheet | އާ މުސާރަ ޝީޓެއް | needs_review | Plain translation using existing app terms. |
| `staff.new_sheet_hint` | The sheet starts with every active staff member and their basic salary. You can change the amounts before finalizing. | ޝީޓް ފެށޭނީ ހުރިހާ އެކްޓިވް ސްޓާފުންނާއި އެމީހުންގެ ބޭސިކް މުސާރައާއެކު. ފައިނަލްކުރުމުގެ ކުރިން އަދަދުތައް ބަދަލުކުރެވޭނެ. | needs_review | Plain translation using existing app terms. |
| `staff.next_week` | Next week | އަންނަ ހަފްތާ | needs_review | Plain translation using existing app terms. |
| `staff.no_sheets` | No salary sheets yet | އަދި މުސާރަ ޝީޓެއް ނެތް | needs_review | Plain translation using existing app terms. |
| `staff.no_sheets_hint` | Create the first sheet for this month. | މި މަހުގެ ފުރަތަމަ ޝީޓް ހަދާ. | needs_review | Plain translation using existing app terms. |
| `staff.no_shifts` | No shifts yet | އަދި ޝިފްޓެއް ނެތް | needs_review | Plain translation using existing app terms. |
| `staff.no_shifts_hint` | Add shifts (e.g. Morning, Evening) in the Shifts tab to assign them here. | މިތާނގައި ޝިފްޓު ދިނުމަށް، ޝިފްޓުތައް ޓެބުގައި ޝިފްޓުތައް (މިސާލަކަށް: ހެނދުނު، ހަވީރު) އިތުރުކުރޭ. | needs_review | Tab name must match staff.tab_shifts; examples match preset_morning/evening. |
| `staff.no_shifts_presets` | Start with a common shift, or add your own. | އާންމު ޝިފްޓަކުން ފަށާ، ނުވަތަ އަމިއްލަ ޝިފްޓެއް އިތުރުކުރޭ. | needs_review | Plain translation using existing app terms. |
| `staff.no_staff` | No staff yet | އަދި ސްޓާފުން ނެތް | needs_review | Plain translation using existing app terms. |
| `staff.no_staff_hint` | Add the people who work here to make salary sheets and the duty rota. | މުސާރަ ޝީޓާއި ޑިއުޓީ ރޯސްޓަރު ހެދުމަށް، މިތާ މަސައްކަތްކުރާ މީހުން އިތުރުކުރޭ. | needs_review | Plain translation using existing app terms. |
| `staff.payroll_subtitle` | Monthly salaries for your staff: basic pay, allowances, overtime, deductions and advances. | ސްޓާފުންގެ މަހު މުސާރަ: ބޭސިކް މުސާރަ، އެލަވަންސް، އޯވަޓައިމް، ކެނޑުންތަކާއި އެޑްވާންސް. | needs_review | Plain translation using existing app terms. |
| `staff.payroll_title` | Salary sheets | މުސާރަ ޝީޓްތައް | needs_review | Plain translation using existing app terms. |
| `staff.payslip` | Payslip | މުސާރަ ސްލިޕް | needs_review | New: individual payslips. ސްލިޕް = slip. |
| `staff.position` | Position | މަޤާމު | needs_review | މަޤާމު = job position/post. |
| `staff.position_placeholder` | e.g. Chef, Waiter, Cashier | މިސާލަކަށް: ޝެފް، ވެއިޓަރު، ކޭޝިއަރު | needs_review | Plain translation using existing app terms. |
| `staff.prepared_by` | Prepared by | ތައްޔާރުކުރީ | needs_review | Print label; "prepared by" = ތައްޔާރުކުރީ. |
| `staff.preset_evening` | Evening | ހަވީރު | needs_review | Plain translation using existing app terms. |
| `staff.preset_morning` | Morning | ހެނދުނު | needs_review | Plain translation using existing app terms. |
| `staff.preset_split` | Lunch | މެންދުރު | needs_review | English label is "Lunch"; rendered as މެންދުރު (midday). |
| `staff.prev_week` | Previous week | ކުރީ ހަފްތާ | needs_review | Alternative: ފާއިތުވި ހަފްތާ. |
| `staff.print_payslip` | Print payslip for {{name}} | {{name}} ގެ މުސާރަ ސްލިޕް ޕްރިންޓްކުރޭ | needs_review | New: individual payslips. ސްލިޕް = slip. |
| `staff.remove_body` | {{name}} will be removed from the staff list. Past salary sheets keep their records. | {{name}} ސްޓާފުންގެ ލިސްޓުން ނަގާލެވޭނެ. ކުރީގެ މުސާރަ ޝީޓްތަކުގެ ރެކޯޑުތައް ބާކީ ހުންނާނެ. | needs_review | Plain translation using existing app terms. |
| `staff.remove_from_sheet` | Remove from this sheet | މި ޝީޓުން ނަގާލާ | needs_review | Plain translation using existing app terms. |
| `staff.remove_shift` | Delete shift? | ޝިފްޓު ޑިލީޓްކުރަންތަ؟ | needs_review | Plain translation using existing app terms. |
| `staff.remove_shift_body` | “{{name}}” will be deleted and removed from every day it is used in the rota. | “{{name}}” ޑިލީޓްކުރެވި، ރޯސްޓަރުގައި ބޭނުންކޮށްފައިވާ ހުރިހާ ދުވަހަކުން ނަގާލެވޭނެ. | needs_review | Plain translation using existing app terms. |
| `staff.remove_title` | Remove staff member? | ސްޓާފު ނަގާލަންތަ؟ | needs_review | Plain translation using existing app terms. |
| `staff.reopen` | Reopen | އަލުން ހުޅުވާ | needs_review | Plain translation using existing app terms. |
| `staff.reopen_body` | The sheet becomes editable again. | ޝީޓް އަލުން ބަދަލުކުރެވޭނެ. | needs_review | Plain translation using existing app terms. |
| `staff.reopen_with_expense` | The sheet becomes editable again and the Salaries expense added for it is removed, so it is not counted twice. | ޝީޓް އަލުން ބަދަލުކުރެވޭނެ، އަދި މީގެ ސަބަބުން އިތުރުކުރި މުސާރައިގެ ޚަރަދު ފޮހެލެވޭނެ، ދެފަހަރު ނުގުނޭތޯ. | needs_review | Check flow of the final clause (ދެފަހަރު ނުގުނޭތޯ = so it is not counted twice). |
| `staff.rota_no_staff_hint` | Add staff in the Staff tab, then set their shifts here. | ސްޓާފުން ޓެބުގައި ސްޓާފުން އިތުރުކޮށް، ދެން މިތާނގައި އެމީހުންގެ ޝިފްޓުތައް ކަނޑައަޅާ. | needs_review | Tab names must match staff.tab_staff. |
| `staff.rota_subtitle` | Who works which shift each day of the week. | ހަފްތާގެ ކޮންމެ ދުވަހަކު ކޮން ޝިފްޓެއްގައި ކާކު މަސައްކަތްކުރާނެ. | needs_review | Plain translation using existing app terms. |
| `staff.rota_title` | Duty rota | ޑިއުޓީ ރޯސްޓަރު | needs_review | Plain translation using existing app terms. |
| `staff.salary_sheet` | Salary sheet | މުސާރަ ޝީޓް | needs_review | Plain translation using existing app terms. |
| `staff.sheet_empty` | No staff on this sheet. Use “Add missing staff”. | މި ޝީޓުގައި ސްޓާފުން ނެތް. “ނެތް ސްޓާފުން އިތުރުކުރޭ” ބޭނުންކުރޭ. | needs_review | Quoted button label must match staff.add_missing_staff. |
| `staff.sheet_notes` | Notes for this month | މި މަހުގެ ނޯޓްސް | needs_review | Plain translation using existing app terms. |
| `staff.sheet_title` | Salary sheet — {{month}} | މުސާރަ ޝީޓް — {{month}} | needs_review | Plain translation using existing app terms. |
| `staff.sheets_hint` | One salary sheet per month. Finalize it when the salaries are paid. | ކޮންމެ މަހަކަށް އެއް މުސާރަ ޝީޓް. މުސާރަ ދީފައި ނިމުމުން ފައިނަލްކުރޭ. | needs_review | Plain translation using existing app terms. |
| `staff.shifts_hint` | Shift names and times used in the rota. | ރޯސްޓަރުގައި ބޭނުންކުރާ ޝިފްޓުތަކުގެ ނަމާއި ގަޑިތައް. | needs_review | Plain translation using existing app terms. |
| `staff.signature` | Signature | ސޮއި | needs_review | Plain translation using existing app terms. |
| `staff.staff_count_one` | {{count}} staff member | {{count}} ސްޓާފު | needs_review | Singular ސްޓާފު vs plural ސްޓާފުން. |
| `staff.staff_count_other` | {{count}} staff members | {{count}} ސްޓާފުން | needs_review | Plain translation using existing app terms. |
| `staff.staff_hint` | Everyone who works here. Staff do not need a login. | މިތާ މަސައްކަތްކުރާ ހުރިހާ މީހުން. ސްޓާފުންނަށް ލޮގިނެއް ނުބޭނުންވޭ. | needs_review | Plain translation using existing app terms. |
| `staff.staff_member` | Staff member | ސްޓާފު | needs_review | Alternative: މުވައްޒަފު (used in reports.*). |
| `staff.start_time` | Starts | ފަށާ ގަޑި | needs_review | Literal "start time". |
| `staff.status_draft` | Draft | ޑްރާފްޓް | needs_review | Plain translation using existing app terms. |
| `staff.status_finalized` | Finalized | ފައިނަލްކޮށްފައި | needs_review | Alternative: ނިންމާފައި. |
| `staff.tab_rota` | Rota | ރޯސްޓަރު | needs_review | Plain translation using existing app terms. |
| `staff.tab_sheets` | Salary sheets | މުސާރަ ޝީޓްތައް | needs_review | Plain translation using existing app terms. |
| `staff.tab_shifts` | Shifts | ޝިފްޓުތައް | needs_review | Plain translation using existing app terms. |
| `staff.tab_staff` | Staff | ސްޓާފުން | needs_review | Plain translation using existing app terms. |
| `staff.this_week` | This week | މި ހަފްތާ | needs_review | Plain translation using existing app terms. |
| `staff.total_deductions` | Total deductions | ޖުމްލަ ކެނޑުން | needs_review | New: individual payslips. ސްލިޕް = slip. |
| `staff.total_net_pay` | Total net pay | ޖުމްލަ ނެޓް މުސާރަ | needs_review | Plain translation using existing app terms. |
| `staff.unsaved` | You have unsaved changes. | ރައްކާނުކުރާ ބަދަލުތައް އެބަހުރި. | needs_review | Literal: "there are unsaved changes". |
| `stock_check.empty_body` | Scan a barcode or type a name to check the stock instantly. | ސްޓޮކް ވަގުތުން ބެލުމަށް ބާކޯޑް ސްކޭން ކުރައްވާ ނުވަތަ ނަން ލިޔުއްވާ. | needs_review | New: retail shops (stock check, barcode). |
| `stock_check.empty_title` | Do we have it? | އެ އެއްޗެއް ހުރިތޯ؟ | needs_review | New: retail shops (stock check, barcode). |
| `stock_check.not_found` | No product found | އެ ތަކެތި ނުފެނުނު | needs_review | New: retail shops (stock check, barcode). |
| `stock_check.not_found_body` | Nothing matches “{{q}}”. | “{{q}}” އާ ގުޅޭ އެއްވެސް އެއްޗެއް ނެތް. | needs_review | New: retail shops (stock check, barcode). |
| `stock_check.placeholder` | Scan barcode or type product name… | ބާކޯޑް ސްކޭން ކުރައްވާ ނުވަތަ ތަކެއްޗުގެ ނަން ލިޔުއްވާ… | needs_review | New: retail shops (stock check, barcode). |
| `stock_check.status_in_stock` | In stock | ސްޓޮކުގައި ހުރި | needs_review | New: retail shops (stock check, barcode). |
| `stock_check.status_low` | Low stock | ސްޓޮކް މަދު | needs_review | New: retail shops (stock check, barcode). |
| `stock_check.status_out` | Out of stock | ސްޓޮކް ހުސް | needs_review | New: retail shops (stock check, barcode). |
| `stock_check.status_untracked` | Stock not tracked | ސްޓޮކް ނުބެލޭ | needs_review | New: retail shops (stock check, barcode). |
| `stock_check.subtitle` | Scan or type a product to see if it is in stock here and at your other outlets. | މި ފިހާރައާއި އެހެން އައުޓްލެޓްތަކުގައި އެއްޗެއް ހުރިތޯ ބެލުމަށް ސްކޭން ކުރައްވާ ނުވަތަ ނަން ލިޔުއްވާ. | needs_review | New: retail shops (stock check, barcode). |
| `stock_check.title` | Stock check | ސްޓޮކް ބެލުން | needs_review | New: retail shops (stock check, barcode). |
| `superadmin.business.addon_requests_one` | {{count}} add-on requested | {{count}} އެޑް-އޮނަށް އެދިފައި | needs_review | Dhivehi does not inflect after numbers; _one/_other identical. "Add-on" = އެޑް-އޮން as in superadmin.business.*. |
| `superadmin.business.addon_requests_other` | {{count}} add-ons requested | {{count}} އެޑް-އޮނަށް އެދިފައި | needs_review | Same as _one. |
| `superadmin.business.enable` | Enable | ހުޅުވާ | needs_review | Matches common.enabled (ހުޅުވިފައި). Alternative: އެނޭބަލްކުރޭ. |
| `superadmin.businesses.created` | Business created | ވިޔަފާރި ހެދިއްޖެ | needs_review | Updated: platform now includes shops. |
| `superadmin.businesses.subtitle` | All businesses on the platform: restaurants, cafés and shops. | ޕްލެޓްފޯމްގައިވާ ހުރިހާ ވިޔަފާރިތައް: ރެސްޓޯރަންޓް، ކެފޭ އަދި ފިހާރަތައް. | needs_review | Updated: platform now includes shops. |
| `superadmin.credentials.change_note` | The owner must choose their own password at the first sign-in. | ފުރަތަމަ ފަހަރު ލޮގިން ކުރާއިރު ވެރިފަރާތުން އަމިއްލަ ޕާސްވޯޑެއް ހަދަން ޖެހޭނެ. | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.credentials.copied` | Copied — paste it into a message to the owner. | ކޮޕީ ކުރެވިއްޖެ — ވެރިފަރާތަށް ފޮނުވާ މެސެޖަކަށް ޕޭސްޓް ކުރައްވާ. | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.credentials.copy` | Copy details | މަޢުލޫމާތު ކޮޕީ ކުރޭ | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.credentials.copy_failed` | Could not copy. Please select and copy the details. | ކޮޕީ ނުކުރެވުނު. މަޢުލޫމާތު ސިލެކްޓްކޮށް ކޮޕީ ކުރައްވާ. | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.credentials.first_password` | First password | ފުރަތަމަ ޕާސްވޯޑް | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.credentials.first_password_hint` | Give this to the owner. They change it when they first sign in. | މިއީ ވެރިފަރާތަށް ދޭނެ ޕާސްވޯޑް. ފުރަތަމަ ލޮގިން ކުރާއިރު ބަދަލުކުރަން ޖެހޭނެ. | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.credentials.generate` | Generate | އަލަށް ހަދާ | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.credentials.login_link` | Sign-in link | ލޮގިން ލިންކް | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.credentials.new_password` | New password | އައު ޕާސްވޯޑް | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.credentials.open_business` | Open business | ވިޔަފާރި ހުޅުވާ | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.credentials.set_password` | Set owner password | ވެރިފަރާތުގެ ޕާސްވޯޑް ހަދާ | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.credentials.set_password_hint` | For an owner who forgot their password. They are signed out and must change it at the next sign-in. | ޕާސްވޯޑް ހަނދާން ނެތިފައިވާ ވެރިފަރާތަކަށް. އެފަރާތް ލޮގްއައުޓް ވެ، ދެން ލޮގިން ކުރާއިރު ބަދަލުކުރަން ޖެހޭނެ. | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.credentials.title` | Sign-in details to give the owner | ވެރިފަރާތަށް ދޭންވީ ލޮގިން މަޢުލޫމާތު | needs_review | New: Super Admin gives owners their first password. |
| `superadmin.dashboard.mrr` | Monthly recurring revenue | މަހުން މަހަށް ލިބޭ އާމްދަނީ | needs_review | Financial term; confirm wording. |
| `superadmin.dashboard.retail` | Retail shops | ފިހާރަތައް | needs_review | New: retail shops (stock check, barcode). |
| `superadmin.dashboard.retail_hint` | Shops and supermarkets | ފިހާރަތަކާއި ސުޕަރމާކެޓްތައް | needs_review | New: retail shops (stock check, barcode). |
| `superadmin.nav.payments` | Payments | ފައިސާ ދެއްކުންތައް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.nav.retail` | Retail shops | ފިހާރަތައް | needs_review | New: retail shops (stock check, barcode). |
| `superadmin.payments.approve` | Approve | ޤަބޫލުކުރޭ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.approve_body_one` | Confirm that {{amount}} from {{name}} is in the bank. Their plan is activated for {{count}} month. | {{name}} ގެ ފަރާތުން {{amount}} ބޭންކަށް ލިބިފައިވާކަން ކަށަވަރުކުރޭ. އެ ފަރާތުގެ ޕްލޭން {{count}} މަހަށް އެކްޓިވް ކުރެވޭނެ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.approve_body_other` | Confirm that {{amount}} from {{name}} is in the bank. Their plan is activated for {{count}} months. | {{name}} ގެ ފަރާތުން {{amount}} ބޭންކަށް ލިބިފައިވާކަން ކަށަވަރުކުރޭ. އެ ފަރާތުގެ ޕްލޭން {{count}} މަހަށް އެކްޓިވް ކުރެވޭނެ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.approve_title` | Approve this payment? | މި ފައިސާ ދެއްކުން ޤަބޫލުކުރަންތަ؟ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.approved_toast` | Payment approved — the business is active. | ފައިސާ ދެއްކުން ޤަބޫލުކުރެވިއްޖެ — ވިޔަފާރި އެކްޓިވް ކުރެވިއްޖެ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.business` | Business | ވިޔަފާރި | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.count_month` | Payments this month | މި މަހުގެ ފައިސާ ދެއްކުންތައް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.method` | Method | ފައިސާ ދެއްކި ގޮތް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.method_bank_transfer` | Bank transfer | ބޭންކް ޓްރާންސްފަރ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.method_card` | Card | ކާޑު | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.method_cash` | Cash | ކޭޝް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.method_other` | Other | އެހެނިހެން | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.none` | No payments here. | މިތާ އެއްވެސް ފައިސާ ދެއްކުމެއް ނެތް. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.received_month` | Received this month | މި މަހު ލިބުނު | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.record` | Record payment | ފައިސާ ދެއްކުން ރެކޯޑްކުރޭ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.record_hint` | For payments taken by the team (cash, card). The plan is extended straight away. | ޓީމުން ނަގާ ފައިސާއަށް (ކޭޝް، ކާޑު). ޕްލޭން އެވަގުތުން ދިގުކުރެވޭނެ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.recorded_toast` | Payment recorded and plan extended. | ފައިސާ ދެއްކުން ރެކޯޑްކޮށް ޕްލޭން ދިގުކުރެވިއްޖެ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.reject` | Reject | ރުއްދުކުރޭ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.reject_reason` | Reason | ސަބަބު | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.reject_reason_hint` | The business owner sees this, e.g. "Amount not received" or "Slip is not readable". | މި ސަބަބު ވިޔަފާރީގެ ވެރިފަރާތަށް ފެންނާނެ، މިސާލަކަށް "ފައިސާ ލިބިފައެއް ނުވޭ" ނުވަތަ "ސްލިޕް ކިޔައިގަނެވޭކަށް ނެތް". | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.reject_title` | Reject this payment | މި ފައިސާ ދެއްކުން ރުއްދުކުރޭ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.rejected_toast` | Payment rejected. The owner can upload a new slip. | ފައިސާ ދެއްކުން ރުއްދުކުރެވިއްޖެ. ވެރިފަރާތަށް އައު ސްލިޕެއް އަޕްލޯޑް ކުރެވޭނެ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.subtitle` | Transfer slips from businesses and payments taken by the team. | ވިޔަފާރިތަކުން ފޮނުވާ ޓްރާންސްފަރ ސްލިޕްތަކާއި ޓީމުން ނަގާ ފައިސާ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.title` | Payments | ފައިސާ ދެއްކުންތައް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.until` | Until {{date}} | {{date}} އަށް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.payments.waiting` | Waiting for review | ޗެކްކުރަން ހުރި | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.security.two_factor` | Two-factor authentication | ދެ ފިޔަވަޅުގެ ވެރިފިކޭޝަން | needs_review | Literal; '2FA' loanword may be clearer to admins. |
| `superadmin.settings.bank_details` | Bank details for payments | ފައިސާ ދެއްކުމަށް ބޭންކް މަޢުލޫމާތު | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.settings.bank_details_hint` | Shown to businesses on the payment screen: bank, account name and account number(s). | ފައިސާ ދައްކާ ސްކްރީނުގައި ވިޔަފާރިތަކަށް ފެންނާނެ: ބޭންކް، އެކައުންޓުގެ ނަމާއި އެކައުންޓް ނަންބަރު(ތައް). | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.settings.billing_note` | Payment note | ފައިސާ ދެއްކުމާ ބެހޭ ނޯޓް | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.settings.billing_note_hint` | Optional, e.g. "Use your business name as the reference". | ބޭނުންނަމަ، މިސާލަކަށް "ރެފަރެންސްގައި ތިޔަ ވިޔަފާރީގެ ނަން ލިޔުއްވާ". | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.settings.billing_section` | Billing | ބިލިންގ | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.settings.reminder_days` | Remind before the end (days) | ނިމުމުގެ ކުރިން ހަނދާންކޮށްދޭނީ (ދުވަސް) | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.settings.reminder_days_hint` | Owners see a "Pay now" banner this many days before their trial or plan ends. | ޓްރަޔަލް ނުވަތަ ޕްލޭން ނިމުމުގެ މިހާ ދުވަސް ކުރިން ވެރިފަރާތްތަކަށް "މިހާރު ފައިސާ ދައްކަވާ" ބެނަރެއް ފެންނާނެ. | needs_review | New: subscription billing (bank transfer slip upload and review). |
| `superadmin.status.suspended` | Suspended | ހުއްޓާލާފައި | needs_review | Alternative: ސަސްޕެންޑްކޮށްފައި. |
| `tablet.pos_only_body` | Your account can’t use the POS. Sign in with a cashier or waiter account, or use a computer or phone for the rest of the system. | ތިޔަ އެކައުންޓުން ޕީއޯއެސް ބޭނުން ނުކުރެވޭނެ. ކޭޝިއަރ ނުވަތަ ވެއިޓަރ އެކައުންޓަކުން ވަދެވަޑައިގަންނަވާ، ނޫނީ ސިސްޓަމުގެ އެހެން ބައިތަކަށް ކޮމްޕިއުޓަރު ނުވަތަ ފޯނު ބޭނުން ކުރައްވާ. | needs_review | New: tablet app is POS only. |
| `tablet.pos_only_title` | This tablet is for the POS | މި ޓެބްލެޓަކީ ޕީއޯއެސް އަށް | needs_review | New: tablet app is POS only. |
| `tablet.sign_out_confirm` | Sign out of this tablet? Held orders stay in Open orders; an order that isn’t held is cleared. | މި ޓެބްލެޓުން ސައިން އައުޓް ވާންތޯ؟ ހޯލްޑް ކުރި އޯޑަރުތައް އޯޕަން އޯޑަރުގައި ހުންނާނެ؛ ހޯލްޑް ނުކުރާ އޯޑަރު ފޮހެވޭނެ. | needs_review | New: tablet app is POS only. |
| `time.minutes_ago` | {{count}} minutes ago | {{count}} މިނެޓު ކުރިން | needs_review | Relative time phrasing used in lists (e.g. last sign-in). Confirm natural word order. |
| `viber.on` | ON | ON | needs_review | Kept in Latin; alternative ހުޅުވާ is longer for a switch label. |
| `viber.status_off` | Viber notifications are disabled. Credit transactions will continue normally. | Viber ނޯޓިފިކޭޝަން ބަންދުކޮށްފައި. ދަރަނީގެ މުޢާމަލާތްތައް އާދައިގެ ގޮތުގައި ކުރިއަށް ދާނެ. | needs_review | ބަންދު matches common.disabled. Same notification-term question as status_on. |
| `viber.status_on` | Viber notifications will be sent for Credit (Pay Later) transactions when the customer has a registered Viber number. | ކަސްޓަމަރުގެ Viber ނަންބަރު ރަޖިސްޓަރީކޮށްފައިވާނަމަ، ދަރަންޏަށް (ފަހުން ދައްކާ) ކުރާ މުޢާމަލާތްތަކަށް Viber ނޯޓިފިކޭޝަން ފޮނުވޭނެ. | needs_review | Loanword ނޯޓިފިކޭޝަން used; alternative: އެންގުން / ހަބަރު. Confirm preferred term. |
| `account.reduce_animations` | Reduce animations | އެނިމޭޝަންތައް މަދުކުރޭ | confirmed | Translated by the business owner (native speaker). |
| `account.theme_dark` | Dark | އަނދިރި | confirmed | Translated by the business owner (native speaker). |
| `common.reset` | Reset | އަލުން ފަށާ | confirmed | Translated by the business owner (native speaker). |
| `common.showing_range` | Showing {{from}}–{{to}} of {{total}} | ދައްކަނީ: {{total}} ގެ ތެރެއިން {{from}} އިން {{to}} އަށް | confirmed | Translated by the business owner (native speaker). |
| `credit.all_time` | All time | ހުރިހާ ދުވަސްވަރެއް | confirmed | Translated by the business owner (native speaker). |
| `credit.as_of` | As of | މި ތާރީޚުގެ ނިޔަލަށް | confirmed | Translated by the business owner (native speaker). |
| `credit.available` | Available credit | ބާކީ ހުރި ކްރެޑިޓް | confirmed | Translated by the business owner (native speaker). |
| `credit.balance` | Balance | ބާކީ | confirmed | Translated by the business owner (native speaker). |
| `credit.balance_due` | Balance due | ދައްކަންޖެހޭ ބާކީ ފައިސާ | confirmed | Translated by the business owner (native speaker). |
| `credit.credit` | Credit | ކްރެޑިޓް | confirmed | Translated by the business owner (native speaker). |
| `credit.days` | Credit days | ކްރެޑިޓް މުއްދަތު (ދުވަސް) | confirmed | Translated by the business owner (native speaker). |
| `credit.days_overdue_other` | {{count}} days overdue | މުއްދަތު ހަމަވިތާ {{count}} ދުވަސް | confirmed | Translated by the business owner (native speaker). |
| `credit.debit` | Debit | ޑެބިޓް | confirmed | Translated by the business owner (native speaker). |
| `credit.dues_report` | Customer dues report | ކަސްޓަމަރުން ދައްކަންޖެހޭ ފައިސާގެ ރިޕޯޓް | confirmed | Translated by the business owner (native speaker). |
| `credit.entry` | Entry | އެންޓްރީ | confirmed | Translated by the business owner (native speaker). |
| `credit.fifo_hint` | The payment is applied to the oldest unpaid credit sales first. | ފައިސާ އެންމެ ފުރަތަމަ ކަނޑައެޅޭނީ ނުދައްކާ ހުރި އެންމެ ދުވަސްވީ ކްރެޑިޓް ވިއްކުންތަކަށެވެ. | confirmed | Translated by the business owner (native speaker). |
| `credit.grand_total` | Grand total | ޖުމްލަ އެކު | confirmed | Translated by the business owner (native speaker). |
| `credit.kinds.credit_sale` | Credit sale | ދަރަންޏަށް ވިއްކުން | confirmed | Translated by the business owner (native speaker). |
| `credit.limit` | Credit limit | ކްރެޑިޓް ލިމިޓް | confirmed | Translated by the business owner (native speaker). |
| `credit.outstanding` | Outstanding | ނުދައްކާ ހުރި ޖުމްލަ | confirmed | Translated by the business owner (native speaker). |
| `credit.page_title` | Credit & dues | ކްރެޑިޓް އަދި ދައްކަންޖެހޭ ފައިސާ | confirmed | Translated by the business owner (native speaker). |
| `credit.statement` | Statement | ސްޓޭޓްމަންޓް | confirmed | Translated by the business owner (native speaker). |
| `credit.total_due` | Total due | ޖުމްލަ ދައްކަންޖެހޭ | confirmed | Translated by the business owner (native speaker). |
| `customers.overview` | Overview | ޚުލާޞާ | confirmed | Translated by the business owner (native speaker). |
| `dashboard.good_afternoon` | Good afternoon | މެންދުރުފަހުގެ ސަލާމް | confirmed | Translated by the business owner (native speaker). |
| `dashboard.good_evening` | Good evening | ހަވީރުގެ ސަލާމް | confirmed | Translated by the business owner (native speaker). |
| `dashboard.good_morning` | Good morning | ބާއްޖަވެރި ހެނދުނެއް | confirmed | Translated by the business owner (native speaker). |
| `dashboard.w.kitchen_pending` | Kitchen tickets waiting | ކައްކަން ފޮނުވިފައިވާ ޓިކެޓްތައް | confirmed | Translated by the business owner (native speaker). |
| `documents.service_charge` | Service charge | ސާވިސް ޗާޖް | confirmed | Translated by the business owner (native speaker). |
| `documents.subtotal` | Subtotal | ސަބްޓޯޓަލް | confirmed | Translated by the business owner (native speaker). |
| `documents.tax` | Tax | ޓެކްސް | confirmed | Translated by the business owner (native speaker). |
| `documents.total` | Total | ޖުމްލަ | confirmed | Translated by the business owner (native speaker). |
| `expenses.categories.electricity` | Electricity | ކަރަންޓް | confirmed | ކަރަންޓް — standard everyday term. |
| `expenses.categories.rent` | Rent | ކުލި | confirmed | ކުލި — standard. |
| `expenses.categories.salaries` | Salaries | މުސާރަ | confirmed | މުސާރަ — standard. |
| `karaoke.deposit` | Deposit (cash) | ޑިޕޮސިޓް (ނަގުދު ފައިސާ) | confirmed | Translated by the business owner (native speaker). |
| `karaoke.title` | Karaoke | ކަރައޯކޭ | confirmed | Translated by the business owner (native speaker). |
| `kitchen.actions.ready` | Served | ސާރވްކުރެވިއްޖެ | confirmed | Translated by the business owner (native speaker). |
| `kitchen.rush` | Mark as rush | އަވަސްކުރަން ފާހަގަކުރުން | confirmed | Translated by the business owner (native speaker). |
| `loyalty.points` | Points | ޕޮއިންޓްސް | confirmed | Translated by the business owner (native speaker). |
| `modules.inventory` | Inventory | އިންވެންޓްރީ | confirmed | Translated by the business owner (native speaker). |
| `modules.invoices` | Invoices | އިންވޮއިސްތައް | confirmed | Translated by the business owner (native speaker). |
| `modules.quotations` | Quotations | ކޯޓޭޝަންތައް | confirmed | Translated by the business owner (native speaker). |
| `modules.sales` | Sales | ވިއްކުންތައް | confirmed | Translated by the business owner (native speaker). |
| `nav.activity` | Activity log | ހަރަކާތްތަކުގެ ރެކޯޑް | confirmed | Translated by the business owner (native speaker). |
| `nav.open_pos` | Open POS | ޕީއޯއެސް ހުޅުވާ | confirmed | Translated by the business owner (native speaker). |
| `nav.outlets` | Outlets | އައުޓްލެޓްތައް | confirmed | Translated by the business owner (native speaker). |
| `nav.pos` | POS | ޕީއޯއެސް | confirmed | Translated by the business owner (native speaker). |
| `nav.qr_menu` | QR Menu | ކިއުއާރް މެނޫ | confirmed | Translated by the business owner (native speaker). |
| `notifications.empty` | You're all caught up. | ހުރިހާ މަޢުލޫމާތެއް ވަނީ އަދާހަމަކުރެވިފައި. | confirmed | Translated by the business owner (native speaker). |
| `notify.credit_payment` | {{customer}} paid {{amount}} towards credit | {{customer}} ވަނީ ދަރަންޏަށް {{amount}} ދައްކާފައި | confirmed | Translated by the business owner (native speaker). |
| `palette.actions` | Quick actions | އަވަސް ފިޔަވަޅުތައް | confirmed | Translated by the business owner (native speaker). |
| `palette.placeholder` | Search or jump to… | ހޯއްދަވާ ނުވަތަ ދާންވީ ތަން ޚިޔާރުކުރައްވާ… | confirmed | Translated by the business owner (native speaker). |
| `payment_methods.card` | Card | ކާޑު | confirmed | Translated by the business owner (native speaker). |
| `payment_methods.cash` | Cash | ނަގުދު ފައިސާ | confirmed | Translated by the business owner (native speaker). |
| `payment_methods.credit` | Credit (pay later) | ކްރެޑިޓް (ފަހުން ފައިސާ ދައްކާގޮތަށް) | confirmed | Translated by the business owner (native speaker). |
| `payments.kinds.credit_payment` | Credit payment | ކްރެޑިޓް ފައިސާ ދެއްކުން | confirmed | Translated by the business owner (native speaker). |
| `perm.qr_menu_manage` | Manage QR menu | QR މެނޫ މެނޭޖްކުރޭ | confirmed | Business decision: acronyms (POS, QR, SKU, CSV) stay in Latin letters inside Dhivehi text, matching hardware labels and receipts. |
| `pos.change_due` | Change | އަނބުރާ ދޭންޖެހޭ ފައިސާ | confirmed | Translated by the business owner (native speaker). |
| `pos.credit_to` | {{amount}} on credit to {{name}} | {{amount}} ދަރަންޏަށް {{name}} އަށް | confirmed | Translated by the business owner (native speaker). |
| `pos.discount_short` | Disc. | ޑިސްކައުންޓް | confirmed | Translated by the business owner (native speaker). |
| `pos.hold` | Hold | މަޑުޖައްސާލުން | confirmed | Translated by the business owner (native speaker). |
| `pos.order_types.dine_in` | Dine-in | ތަނުގައި ކެއުން (ޑައިން-އިން) | confirmed | Translated by the business owner (native speaker). |
| `pos.order_types.takeaway` | Takeaway | ޓޭކްއަވޭ | confirmed | Translated by the business owner (native speaker). |
| `pos.redeem_points` | Redeem points (available: {{points}}) | ޕޮއިންޓް ބޭނުންކުރުން (ލިބެންހުރީ: {{points}}) | confirmed | Translated by the business owner (native speaker). |
| `print.bill_to` | Bill to | ބިލް ރައްދުވާ ފަރާތް | confirmed | Translated by the business owner (native speaker). |
| `print.cashier` | Cashier | ކޭޝިއަރު | confirmed | Translated by the business owner (native speaker). |
| `print.change` | Change | އަނބުރާ ދޭންޖެހޭ ފައިސާ | confirmed | Translated by the business owner (native speaker). |
| `print.charges` | Charges | ޗާޖުތައް | confirmed | Translated by the business owner (native speaker). |
| `print.closing_balance` | Closing balance | ނިމުނުއިރު ހުރި ބާކީ ފައިސާ | confirmed | Translated by the business owner (native speaker). |
| `print.days_overdue` | Days overdue | މުއްދަތު ހަމަވި ފަހުން ވީ ދުވަސް | confirmed | Translated by the business owner (native speaker). |
| `print.invoice` | Invoice | އިންވޮއިސް | confirmed | Translated by the business owner (native speaker). |
| `print.open_items` | Unpaid items | ފައިސާ ނުދައްކާ ހުރި އައިޓަމްތައް | confirmed | Translated by the business owner (native speaker). |
| `print.opening_balance` | Opening balance | ފެށުނުއިރު ހުރި ބާކީ ފައިސާ | confirmed | Translated by the business owner (native speaker). |
| `print.overdue_amount` | Overdue | މުއްދަތު ހަމަވެފައި | confirmed | Translated by the business owner (native speaker). |
| `print.payments` | Payments | ދެއްކި ފައިސާ | confirmed | Translated by the business owner (native speaker). |
| `print.pdf_failed` | Could not create the PDF. Try Print → Save as PDF instead. | ޕީޑީއެފް ހެދޭގޮތެއް ނުވި. ޕްރިންޓް → "ސޭވް އޭޒް ޕީޑީއެފް" އަށް ފިއްތަވާލައްވާ. | confirmed | Translated by the business owner (native speaker). |
| `print.prepared_for` | Prepared for | ތައްޔާރުކުރެވުނީ | confirmed | Translated by the business owner (native speaker). |
| `print.quotation` | Quotation | ކޯޓޭޝަން | confirmed | Translated by the business owner (native speaker). |
| `print.receipt` | Receipt | ރަސީދު | confirmed | Translated by the business owner (native speaker). |
| `print.statement` | Statement of account | އެކައުންޓް ސްޓޭޓްމަންޓް | confirmed | Translated by the business owner (native speaker). |
| `print.thank_you` | Thank you! | ޝުކުރިއްޔާ! | confirmed | Translated by the business owner (native speaker). |
| `print.total_outstanding` | Total outstanding | ދައްކަންޖެހޭ ޖުމްލަ ފައިސާ | confirmed | Translated by the business owner (native speaker). |
| `products.cost_price` | Cost price | ގަތް އަގު | confirmed | Translated by the business owner (native speaker). |
| `products.item` | Item | އައިޓަމް | confirmed | Translated by the business owner (native speaker). |
| `products.min_stock` | Low-stock alert at | ސްޓޮކް މަދުވާކަމުގެ އިންޒާރު މި އަދަދަށް ދިޔުމުން: | confirmed | Translated by the business owner (native speaker). |
| `products.photo_hint` | Shown on the POS and the QR menu. Any phone or camera photo works; it is resized automatically. | ޕީއޯއެސް (POS) އަދި ކިއުއާރް މެނޫއިން ފެންނާނެއެވެ. ކޮންމެ ފޯނަކުން ނުވަތަ ކެމެރާއަކުން ނަގާފައިވާ ފޮޓޯއެއްވެސް ބޭނުންކުރެވޭނެއެވެ؛ އޭގެ ސައިޒު އޮޓޮމެޓިކުން ހަމަޖެހޭނެއެވެ. | confirmed | Translated by the business owner (native speaker). |
| `products.recipe_cost` | Cost per portion | ޕޯޝަނަކަށް ޖެހޭ ޚަރަދު | confirmed | Translated by the business owner (native speaker). |
| `products.sku` | SKU | އެސްކޭޔޫ (SKU) | confirmed | Translated by the business owner (native speaker). |
| `products.types.ingredient` | Ingredient | ބޭނުންކުރާ ސާމާނު / ތަކެތި | confirmed | Translated by the business owner (native speaker). |
| `products.types.service` | Service | ޚިދުމަތް | confirmed | Translated by the business owner (native speaker). |
| `products.unit` | Unit | ޔުނިޓް | confirmed | Translated by the business owner (native speaker). |
| `public_menu.not_found_body` | This menu does not exist or is not published. | މި މެނޫއެއް ނެތް ނުވަތަ އަދި ޝާއިއުކޮށްފައެއް ނުވޭ. | confirmed | Translated by the business owner (native speaker). |
| `public_menu.staff_will_take` | Our staff will take your order | އަޅުގަނޑުމެންގެ ސްޓާފަކު ތިޔަބޭފުޅާގެ އޯޑަރު ނަގާނެ | confirmed | Translated by the business owner (native speaker). |
| `public_menu.your_table` | Table {{table}} | މޭޒު {{table}} | confirmed | Translated by the business owner (native speaker). |
| `qr.auto_update` | This QR code never changes. When you edit items, prices or photos, the menu updates automatically. | މި ކިއުއާރް ކޯޑު ދުވަހަކުވެސް ބަދަލެއް ނުވާނެ. އައިޓަމް، އަގު ނުވަތަ ފޮޓޯ ބަދަލުކުރުމުން، މެނޫ އަމިއްލައަށް އަޕްޑޭޓް ވާނެ. | confirmed | Translated by the business owner (native speaker). |
| `qr.card_generic` | Our staff will be with you shortly | އަޅުގަނޑުމެންގެ ސްޓާފަކު އިރުކޮޅަކުން ޚިދުމަތް ދޭނެ | confirmed | Translated by the business owner (native speaker). |
| `qr.card_subtitle` | Point your phone camera at the code | ފޯނުގެ ކެމެރާ ކޯޑާ ދިމާލަށް އަޅުވާލައްވާ | confirmed | Translated by the business owner (native speaker). |
| `qr.card_table` | Table {{table}} | މޭޒު {{table}} | confirmed | Translated by the business owner (native speaker). |
| `qr.card_title` | Scan for menu | މެނޫ ބެއްލެވުމަށް ސްކޭން ކުރައްވާ | confirmed | Translated by the business owner (native speaker). |
| `qr.copied` | Link copied | ލިންކު ކޮޕީކުރެވިއްޖެ | confirmed | Translated by the business owner (native speaker). |
| `qr.copy_link` | Copy link | ލިންކު ކޮޕީކުރޭ | confirmed | Translated by the business owner (native speaker). |
| `qr.customers_can_order` | Customers can order from the menu | ކަސްޓަމަރުންނަށް މެނޫއިން އޯޑަރު ކުރެވޭނެ | confirmed | Translated by the business owner (native speaker). |
| `qr.download_cards` | Download {{count}} cards (PDF) | {{count}} ކާޑު ޑައުންލޯޑް ކުރައްވާ (ޕީޑީއެފް) | confirmed | Translated by the business owner (native speaker). |
| `qr.example_link` | Example link | މިސާލު ލިންކު | confirmed | Translated by the business owner (native speaker). |
| `qr.generic_card` | General card (no table) | އާންމު ކާޑު (މޭޒު ކަނޑަނާޅާ) | confirmed | Translated by the business owner (native speaker). |
| `qr.menu_off` | The menu is switched off. Customers who scan will see that it is unavailable. | މެނޫ ވަނީ ނިއްވާލެވިފައި. ސްކޭންކުރާ ކަސްޓަމަރުންނަށް ފެންނާނީ މެނޫ މިވަގުތު ލިބެން ނެތް ކަމަށެވެ. | confirmed | Translated by the business owner (native speaker). |
| `qr.message_placeholder` | e.g. Welcome! Call a waiter when you are ready to order. | މިސާލަކަށް: މަރުޙަބާ! އޯޑަރު ދެއްވަން ތައްޔާރުވުމުން ވެއިޓަރަކަށް ގޮވާލައްވާ. | confirmed | Translated by the business owner (native speaker). |
| `qr.mode_order` | Customers can place orders themselves from their phone. | ކަސްޓަމަރުންނަށް އެބޭފުޅުންގެ ފޯނުން އަމިއްލައަށް އޯޑަރު ކުރެވޭނެ. | confirmed | Translated by the business owner (native speaker). |
| `qr.mode_view_only` | Menu only. Customers browse the menu and your staff take the order. | ހަމައެކަނި މެނޫ ބެލުމަށް. ކަސްޓަމަރުން މެނޫ ބަލާނީ، އަދި އޯޑަރު ނަގާނީ ސްޓާފުން. | confirmed | Translated by the business owner (native speaker). |
| `qr.no_tables` | No tables yet. Add tables to print a card for each one, or print a general card. | އަދި އެއްވެސް މޭޒެއް ނެތް. ކޮންމެ މޭޒަކަށް ވަކިން ކާޑު ޕްރިންޓް ކުރުމަށްޓަކައި މޭޒު އިތުރުކުރައްވާ، ނުވަތަ އާންމު ކާޑެއް ޕްރިންޓް ކުރައްވާ. | confirmed | Translated by the business owner (native speaker). |
| `qr.open_menu` | Open menu | މެނޫ ހުޅުވާ | confirmed | Translated by the business owner (native speaker). |
| `qr.settings` | Menu settings | މެނޫ ސެޓިންގްސް | confirmed | Translated by the business owner (native speaker). |
| `qr.subtitle` | Customers scan the code at their table to see your menu. No printed menu books needed. | މެނޫ ބެލުމަށްޓަކައި ކަސްޓަމަރުން މޭޒުމަތީގައިވާ ކޯޑު ސްކޭން ކުރާނެ. ޕްރިންޓްކޮށްފައިވާ މެނޫ ފޮތްތަކެއް ބޭނުމެއް ނުވާނެ. | confirmed | Translated by the business owner (native speaker). |
| `qr.table_cards` | Table QR cards | މޭޒުގެ ކިއުއާރް ކާޑުތައް | confirmed | Translated by the business owner (native speaker). |
| `qr.table_cards_hint` | Print one card for each table. The card shows the table name, so staff know where the customer is sitting. | ކޮންމެ މޭޒަކަށް ކާޑެއް ޕްރިންޓް ކުރައްވާ. ކާޑުގައި މޭޒުގެ ނަން އިންނާނެތީ، ކަސްޓަމަރު އިން ތަން ސްޓާފުންނަށް އެނގޭނެ. | confirmed | Translated by the business owner (native speaker). |
| `qr.title` | QR Menu | ކިއުއާރް މެނޫ | confirmed | Translated by the business owner (native speaker). |
| `quotations.valid_until` | Valid until | މުއްދަތު ހަމަވާ ތާރީޚް | confirmed | Translated by the business owner (native speaker). |
| `reports.types.credit` | Credit & dues | ކްރެޑިޓް އަދި ދައްކަންޖެހޭ ފައިސާ | confirmed | Translated by the business owner (native speaker). |
| `reservations.party_other` | {{count}} guests | {{count}} މެހެމާނުން | confirmed | Translated by the business owner (native speaker). |
| `reservations.title` | Reservations | ރިޒަވޭޝަންތައް | confirmed | Translated by the business owner (native speaker). |
| `roles.system.business_admin` | Business Admin | ބިޒްނަސް އެޑްމިން | confirmed | Translated by the business owner (native speaker). |
| `roles.system.cashier` | Cashier | ކޭޝިއަރު | confirmed | Translated by the business owner (native speaker). |
| `roles.system.kitchen_staff` | Kitchen Staff | ބަދިގޭގެ ސްޓާފުން | confirmed | Translated by the business owner (native speaker). |
| `roles.system.salesperson` | Salesperson | ސޭލްސްޕާސަން | confirmed | Translated by the business owner (native speaker). |
| `roles.system.waiter` | Waiter | ވެއިޓަރު | confirmed | Translated by the business owner (native speaker). |
| `roles.title` | Roles & permissions | ރޯލްތަކާއި ހުއްދަތައް | confirmed | Translated by the business owner (native speaker). |
| `sales.void` | Void | ބާތިލު | confirmed | Translated by the business owner (native speaker). |
| `sales.void_hint` | Stock is returned and payments are reversed. This cannot be undone. | ސްޓޮކް އަނބުރާ ޖަމާވާނެ އަދި ފައިސާ އަނބުރާ ރައްދުވާނެއެވެ. މިކަން އަނބުރާއެއް ނުގެނެވޭނެއެވެ. | confirmed | Translated by the business owner (native speaker). |
| `settings.service_charge_enabled` | Apply service charge | ސަރވިސް ޗާޖު ނަގާ | confirmed | ސަރވިސް ޗާޖު is the common term on Maldivian bills. |
| `settings.tabs.receipt` | Receipts | ރަސީދު | confirmed | Standard term. |
| `status_labels.available` | Available | ލިބެންހުރި | confirmed | Translated by the business owner (native speaker). |
| `status_labels.issued` | Issued | ދޫކުރެވިފައި | confirmed | Translated by the business owner (native speaker). |
| `status_labels.no_show` | No-show | ހާޒިރެއްނުވޭ | confirmed | Translated by the business owner (native speaker). |
| `status_labels.occupied` | Occupied | ބޭނުންކުރެވެނީ | confirmed | Translated by the business owner (native speaker). |
| `status_labels.overdue` | Overdue | މުއްދަތު ހަމަވެފައި | confirmed | Translated by the business owner (native speaker). |
| `status_labels.rejected` | Rejected | ރިޖެކްޓްކުރެވިފައި | confirmed | Translated by the business owner (native speaker). |
| `status_labels.seated` | Seated | އިށީނދެފައި | confirmed | Translated by the business owner (native speaker). |
| `status_labels.void` | Void | ބާތިލު | confirmed | Translated by the business owner (native speaker). |
| `status.pending_title` | Awaiting approval | އެޕްރޫވަލްގެ އިންތިޒާރުގައި | confirmed | Translated by the business owner (native speaker). |
| `system.faruma_missing` | The Faruma font is not installed, so Dhivehi text may not display correctly. | ފަރުމާ ފޮންޓް އިންސްޓޯލް ކުރެވިފައި ނެތުމުން، ދިވެހި ލިޔުންތައް ރަނގަޅަށް ނުފެނިދާނެއެވެ. | confirmed | Translated by the business owner (native speaker). |
| `tables.seats_other` | {{count}} seats | {{count}} ގޮނޑި | confirmed | Translated by the business owner (native speaker). |
| `users.owner` | Owner | ވެރިޔާ | confirmed | Translated by the business owner (native speaker). |
| `validation.too_many` | Select at most {{max}}. | ގިނަވެގެން {{max}} ޚިޔާރުކުރައްވާ. | confirmed | Translated by the business owner (native speaker). |
