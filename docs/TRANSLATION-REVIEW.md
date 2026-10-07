# Dhivehi translation review

Generated from `packages/shared/locales/review/dv.json` — edit that file, then run
`npx tsx packages/shared/scripts/review-md.ts`.

Status: **needs_review**: 77 · **confirmed**: 144

All other Dhivehi strings (`packages/shared/locales/dv.json`, 764 keys) are complete drafts using common Maldivian
business usage (English loanwords in Thaana for system terms such as ޕާސްވޯޑް, ސެޓިންގްސް, އިންވޮއިސް). A native
review of the whole file is still recommended before launch.

| Translation key | English | Suggested Dhivehi | Status | Notes |
| --- | --- | --- | --- | --- |
| `activity.actions.karaoke_no_show` | Karaoke booking no-show | ކަރައޮކޭ ބުކިންގ – ނާދޭ | needs_review | Uses dash '–' between noun and status; see status_labels.no_show. |
| `addons.names.credit` | Credit / Customer Due | ކްރެޑިޓް / ކަސްޓަމަރުގެ ދަރަނި | needs_review | Business terminology decision: ދަރަނި (debt) vs ކްރެޑިޓް. Spec requires 'Credit Sale / Customer Due / Outstanding Balance / Credit Payment' wording — please confirm Dhivehi equivalents before Phase 4. |
| `common.done` | Done | ނިމިއްޖެ | needs_review | Button that closes a finished step. |
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
| `documents.server_totals_hint` | Totals are recalculated by the server when you save. | ސޭވްކުރާއިރު ޖުމްލަތައް ސާވަރުން އަލުން ހިސާބުކުރާނެ. | needs_review | Technical note mentioning the server (ސާވަރު, as in existing settings.hints.tax). |
| `expenses.categories.ingredients` | Ingredients | ކާނާގެ ތަކެތި | needs_review | ކާނާގެ ތަކެތި; see products.types.ingredient. |
| `expenses.payee` | Paid to | ފައިސާ ދިން ފަރާތް | needs_review | Paid to: ފައިސާ ދިން ފަރާތް. |
| `inventory.add_supply` | Add stock item | ސްޓޮކް އައިޓަމެއް އިތުރުކުރޭ | needs_review | Loanwords ސްޓޮކް/އައިޓަމް follow existing inventory strings. Alternative: ސްޓޮކަށް ތަކެއްޗެއް އިތުރުކުރޭ. |
| `inventory.add_supply_hint` | For things you use but don't sell, like a milk powder packet, cups or syrup. Tracked in stock, hidden from the POS. | ބޭނުންކުރާ ނަމަވެސް ނުވިއްކާ ތަކެތި، މިސާލަކަށް މިލްކް ޕައުޑަރު ޕެކެޓެއް، ކަޕު ނުވަތަ ސިރަޕް. ސްޓޮކުގައި ބަލަހައްޓާނެ، POSގައި ނުފެންނާނެ. | needs_review | Milk powder and cups rendered as loanwords (މިލްކް ޕައުޑަރު, ކަޕު); confirm local café usage (e.g. ކިރުގަނޑު). |
| `inventory.adjust` | Adjust stock | ސްޓޮކް އެޑްޖަސްޓްކުރޭ | needs_review | Loanword ސްޓޮކް އެޑްޖަސްޓްކުރޭ follows existing perm.inventory_adjust. Native alternative: ސްޓޮކް ރަނގަޅުކުރޭ. |
| `inventory.kinds.supplies` | Ingredients & supplies | ތަކެތި އަދި ސަޕްލައިސް | needs_review | ތަކެތި for ingredients matches products.add_ingredient; ސަޕްލައިސް is a loanword. |
| `inventory.modes.set` | Set counted quantity | ގުނި އަދަދު ސެޓްކުރޭ | needs_review | 'Set counted quantity' — ގުނި އަދަދު ސެޓްކުރޭ; confirm. |
| `inventory.modes.wastage` | Record wastage | ގެއްލުނު / ހަލާކުވި ތަކެތި ރެކޯޑުކުރޭ | needs_review | Wastage rendered as ގެއްލުނު / ހަލާކުވި ތަކެތި (lost/spoiled). Alternative loanword: ވޭސްޓޭޖް. Also inventory.types.wastage. |
| `inventory.transfer` | Transfer | ޓްރާންސްފަރ | needs_review | Loanword ޓްރާންސްފަރ, from existing addons.descriptions.advanced_inventory. Native alternative: ބަދަލުކުރުން. |
| `inventory.types.transfer_in` | Transfer in | ޓްރާންސްފަރ (ލިބުނު) | needs_review | Rendered with parenthetical (ލިބުނު); alternative: ވަދެފައިވާ ޓްރާންސްފަރ. |
| `inventory.types.wastage` | Wastage | ގެއްލުނު / ހަލާކުވި | needs_review | See inventory.modes.wastage. |
| `invoices.issue` | Issue invoice | އިންވޮއިސް ނެރޭ | needs_review | 'Issue invoice' as އިންވޮއިސް ނެރޭ (lit. 'release/publish'). Alternatives: އިންވޮއިސް ފައިނަލްކުރޭ, އިޝޫކުރޭ. Also status_labels.issued (ނެރެފައި), documents.actions_done.issue, activity.actions.invoice_issued, documents.confirm.issue_title. |
| `menu_i18n.description_in` | Description in {{language}} | {{language}} ބަހުން ތަފްޞީލު | needs_review | New: labels for item names in other languages. |
| `menu_i18n.hint` | Shown on the QR menu when a customer picks this language. Leave empty to show the main name. | ކަސްޓަމަރަކު މި ބަސް ޚިޔާރުކުރުމުން ކިއުއާރް މެނޫގައި ފެންނާނީ މިއެވެ. ހުސްކޮށް ބަހައްޓައިފިނަމަ މައި ނަން ފެންނާނެއެވެ. | needs_review | New: labels for item names in other languages. |
| `menu_i18n.message_in` | Welcome message in {{language}} | {{language}} ބަހުން މަރުޙަބާ މެސެޖު | needs_review | New: labels for item names in other languages. |
| `menu_i18n.more_languages` | More languages | އިތުރު ބަސްތައް | needs_review | New: labels for item names in other languages. |
| `menu_i18n.name_in` | Name in {{language}} | {{language}} ބަހުން ނަން | needs_review | New: labels for item names in other languages. |
| `modules.purchases` | Purchases | ގަތުން | needs_review | Alternative loanword: ޕާޗޭސް. |
| `onboarding.title` | Get set up | ސެޓްއަޕް ކުރައްވާ | needs_review | 'Get set up' → ސެޓްއަޕް ކުރައްވާ. |
| `perm.credit_create` | Make credit sales | ދަރަންޏަށް ވިއްކާ | needs_review | Depends on the credit terminology decision above. |
| `perm.credit_view` | View customer due | ކަސްޓަމަރުންގެ ދަރަނި ބަލާ | needs_review | Depends on the credit terminology decision above. |
| `perm.loyalty_view` | View loyalty points | ލޮޔަލްޓީ ޕޮއިންޓް ބަލާ | needs_review | ލޮޔަލްޓީ ޕޮއިންޓް — consistent with existing addons.names.loyalty. Native alternative not common. |
| `public_menu.menu_title` | Menu | މެނޫ | needs_review | New: dark QR menu design (big title, best-seller badge, items without a category). |
| `public_menu.more` | More | އިތުރު | needs_review | New: dark QR menu design (big title, best-seller badge, items without a category). |
| `public_menu.top` | TOP {{rank}} | ޓޮޕް {{rank}} | needs_review | New: dark QR menu design (big title, best-seller badge, items without a category). |
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
| `reports.columns.gross` | Gross | ގްރޮސް | needs_review | Loanword ގްރޮސް; alternative: ޖުމްލަ (ޑިސްކައުންޓް ކުރިން). |
| `reports.columns.margin` | Margin | މާޖިން | needs_review | Loanword މާޖިން. Alternative: ފައިދާގެ މިންވަރު. |
| `reports.export_csv` | Export CSV | CSV އެކްސްޕޯޓްކުރޭ | needs_review | ސީއެސްވީ transliteration. |
| `reports.rows_count_other` | {{count}} rows | {{count}} ރޯ | needs_review | Loanword ރޯ (row). Dhivehi has no plural inflection after numerals; alternative: {{count}} ލައިން. |
| `reports.summary.cogs` | Cost of goods | ވިއްކި ތަކެތީގެ ކޮސްޓް | needs_review | Cost of goods: ވިއްކި ތަކެތީގެ ކޮސްޓް. Confirm with accountant. |
| `reports.summary.grossProfit` | Gross profit | ގްރޮސް ފައިދާ | needs_review | ގްރޮސް ފައިދާ (mixed loanword). Alternative: ޚަރަދު ކުރިން ފައިދާ. |
| `reports.summary.netProfit` | Net profit | ނެޓް ފައިދާ | needs_review | ނެޓް ފައިދާ. Alternative: ޞާފު ފައިދާ. |
| `reports.types.costing` | Recipe costing | ރެސިޕީގެ ޚަރަދު | needs_review | Recipe costing as ރެސިޕީގެ ޚަރަދު. Existing addons.names.ingredient_costing uses ތަކެތީގެ ޚަރަދު ހިސާބުކުރުން. Note: report columns use loanword ކޮސްޓް for cost of goods while ޚަރަދު is reserved for expenses — confirm this split. |
| `reports.types.profit` | Profit & loss | ފައިދާއާއި ގެއްލުން | needs_review | Profit & loss: ފައިދާއާއި ގެއްލުން — standard phrase, but please confirm. |
| `settings.hints.pos` | How the point of sale behaves. | ޕޮއިންޓް އޮފް ސޭލް ހިނގާނެ ގޮތް. | needs_review | 'Point of sale' transliterated ޕޮއިންޓް އޮފް ސޭލް. Alternative: ވިއްކާ ސިސްޓަމް. |
| `settings.loyalty.points_per_unit` | Points per 1 currency unit spent | ޚަރަދުކުރާ ކޮންމެ 1 ފައިސާ ޔުނިޓަކަށް ލިބޭ ޕޮއިންޓް | needs_review | Long phrasing; check clarity. |
| `settings.pos.allow_negative_stock` | Allow selling when out of stock | ސްޓޮކް ނެތްއިރުވެސް ވިއްކުމުގެ ހުއްދަ | needs_review | Check phrasing: ސްޓޮކް ނެތްއިރުވެސް ވިއްކުމުގެ ހުއްދަ. |
| `superadmin.business.enable` | Enable | ހުޅުވާ | needs_review | Matches common.enabled (ހުޅުވިފައި). Alternative: އެނޭބަލްކުރޭ. |
| `superadmin.dashboard.mrr` | Monthly recurring revenue | މަހުން މަހަށް ލިބޭ އާމްދަނީ | needs_review | Financial term; confirm wording. |
| `superadmin.security.two_factor` | Two-factor authentication | ދެ ފިޔަވަޅުގެ ވެރިފިކޭޝަން | needs_review | Literal; '2FA' loanword may be clearer to admins. |
| `superadmin.status.suspended` | Suspended | ހުއްޓާލާފައި | needs_review | Alternative: ސަސްޕެންޑްކޮށްފައި. |
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
