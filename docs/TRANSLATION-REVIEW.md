# Dhivehi translation review

Generated from `packages/shared/locales/review/dv.json` — edit that file, then run
`npx tsx packages/shared/scripts/review-md.ts`.

Status: **needs_review**: 26 · **confirmed**: 7

All other Dhivehi strings (`packages/shared/locales/dv.json`, 764 keys) are complete drafts using common Maldivian
business usage (English loanwords in Thaana for system terms such as ޕާސްވޯޑް, ސެޓިންގްސް, އިންވޮއިސް). A native
review of the whole file is still recommended before launch.

| Translation key | English | Suggested Dhivehi | Status | Notes |
| --- | --- | --- | --- | --- |
| `account.reduce_animations` | Reduce animations | އެނިމޭޝަން ކުޑަކުރޭ | needs_review | Technical term; confirm users understand it. |
| `account.theme_dark` | Dark | އަނދިރި | needs_review | Alternative loanword: ޑާކް މޯޑް. |
| `addons.names.credit` | Credit / Customer Due | ކްރެޑިޓް / ކަސްޓަމަރުގެ ދަރަނި | needs_review | Business terminology decision: ދަރަނި (debt) vs ކްރެޑިޓް. Spec requires 'Credit Sale / Customer Due / Outstanding Balance / Credit Payment' wording — please confirm Dhivehi equivalents before Phase 4. |
| `common.reset` | Reset | ފުރަތަމަ ހާލަތަށް | needs_review | Used on settings forms to discard unsaved edits. Alternative: ރީސެޓް. |
| `common.showing_range` | Showing {{from}}–{{to}} of {{total}} | {{total}} އިން {{from}}–{{to}} ދައްކަނީ | needs_review | Word order with numbers in RTL — please check it reads naturally. |
| `dashboard.good_afternoon` | Good afternoon | މެންދުރު ފަހުގެ ސަލާމް | needs_review | Time-of-day greetings are not idiomatic in Dhivehi. Option: always show އައްސަލާމު ޢަލައިކުމް. |
| `dashboard.good_evening` | Good evening | ހަވީރުގެ ސަލާމް | needs_review | See dashboard.good_afternoon. |
| `dashboard.good_morning` | Good morning | ހެނދުނުގެ ސަލާމް | needs_review | See dashboard.good_afternoon. |
| `modules.inventory` | Inventory | ސްޓޮކް | needs_review | Alternatives: އިންވެންޓަރީ, ގުދަން (storeroom). Chose ސްޓޮކް as the everyday word in shops. |
| `modules.invoices` | Invoices | އިންވޮއިސް | needs_review | Loanword used in Maldivian business. Alternative: ބިލު (but ބިލު is commonly a café/restaurant bill, which would clash with receipts). Business decision needed. |
| `modules.purchases` | Purchases | ގަތުން | needs_review | Alternative loanword: ޕާޗޭސް. |
| `modules.quotations` | Quotations | ކޮޓޭޝަން | needs_review | Loanword. Alternative: އަގު ހުށަހެޅުން. Which do your salespeople and customers actually use? |
| `modules.sales` | Sales | ވިއްކުން | needs_review | Alternative loanword: ސޭލްސް. ވިއްކުން reads naturally in reports; ސޭލްސް is common in POS UIs. |
| `nav.activity` | Activity log | ހަރަކާތްތަކުގެ ލޮގް | needs_review | Alternative: އޮޑިޓް ލޮގް. |
| `nav.outlets` | Outlets | އައުޓްލެޓްތައް | needs_review | Alternatives: ބްރާންޗުތައް, ފިހާރަތައް. ބްރާންޗު may be clearer for multi-branch restaurants. |
| `perm.credit_create` | Make credit sales | ދަރަންޏަށް ވިއްކާ | needs_review | Depends on the credit terminology decision above. |
| `perm.credit_view` | View customer due | ކަސްޓަމަރުންގެ ދަރަނި ބަލާ | needs_review | Depends on the credit terminology decision above. |
| `roles.system.business_admin` | Business Admin | ބިޒްނަސް އެޑްމިން | needs_review | Alternative: ވިޔަފާރީގެ އެޑްމިން. |
| `roles.system.salesperson` | Salesperson | ސޭލްސް ޕާސަން | needs_review | Alternative: ވިއްކާ މުވައްޒަފު. |
| `roles.title` | Roles & permissions | ރޯލްތަކާއި ހުއްދަތައް | needs_review | ހުއްދަ for 'permission' is natural Dhivehi; some staff may expect the loanword ޕަމިޝަން. |
| `status.pending_title` | Awaiting approval | އެޕްރޫވަލަށް އިންތިޒާރުކުރަނީ | needs_review | Alternative with native vocabulary: ހުއްދައަށް އިންތިޒާރުކުރަނީ. |
| `superadmin.dashboard.mrr` | Monthly recurring revenue | މަހުން މަހަށް ލިބޭ އާމްދަނީ | needs_review | Financial term; confirm wording. |
| `superadmin.security.two_factor` | Two-factor authentication | ދެ ފިޔަވަޅުގެ ވެރިފިކޭޝަން | needs_review | Literal; '2FA' loanword may be clearer to admins. |
| `superadmin.status.suspended` | Suspended | ހުއްޓާލާފައި | needs_review | Alternative: ސަސްޕެންޑްކޮށްފައި. |
| `time.minutes_ago` | {{count}} minutes ago | {{count}} މިނެޓު ކުރިން | needs_review | Relative time phrasing used in lists (e.g. last sign-in). Confirm natural word order. |
| `validation.too_many` | Select at most {{max}}. | {{max}} އަށްވުރެ ގިނަ ނުހޮވާށެވެ. | needs_review | Formal written ending; other messages use a polite conversational tone. |
| `roles.system.cashier` | Cashier | ކެޝިއަރު | confirmed |  |
| `roles.system.kitchen_staff` | Kitchen Staff | ބަދިގޭގެ މުވައްޒަފު | confirmed |  |
| `roles.system.waiter` | Waiter | ވެއިޓަރު | confirmed |  |
| `settings.service_charge_enabled` | Apply service charge | ސަރވިސް ޗާޖު ނަގާ | confirmed | ސަރވިސް ޗާޖު is the common term on Maldivian bills. |
| `settings.tabs.receipt` | Receipts | ރަސީދު | confirmed | Standard term. |
| `system.faruma_missing` | The Faruma font is not installed, so Dhivehi text may not display correctly. | ފަރުމާ ފޮންޓް އިންސްޓޯލްކޮށްފައި ނުވާތީ ދިވެހި ލިޔުން ރަނގަޅަށް ނުފެނިދާނެ. | confirmed |  |
| `users.owner` | Owner | ވެރިފަރާތް | confirmed |  |
