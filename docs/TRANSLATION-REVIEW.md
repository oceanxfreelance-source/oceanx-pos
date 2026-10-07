# Dhivehi translation review

Generated from `packages/shared/locales/review/dv.json` — edit that file, then run
`npx tsx packages/shared/scripts/review-md.ts`.

Status: **needs_review**: 137 · **confirmed**: 23

All other Dhivehi strings (`packages/shared/locales/dv.json`, 764 keys) are complete drafts using common Maldivian
business usage (English loanwords in Thaana for system terms such as ޕާސްވޯޑް, ސެޓިންގްސް, އިންވޮއިސް). A native
review of the whole file is still recommended before launch.

| Translation key | English | Suggested Dhivehi | Status | Notes |
| --- | --- | --- | --- | --- |
| `account.reduce_animations` | Reduce animations | އެނިމޭޝަން ކުޑަކުރޭ | needs_review | Technical term; confirm users understand it. |
| `account.theme_dark` | Dark | އަނދިރި | needs_review | Alternative loanword: ޑާކް މޯޑް. |
| `activity.actions.karaoke_no_show` | Karaoke booking no-show | ކަރައޮކޭ ބުކިންގ – ނާދޭ | needs_review | Uses dash '–' between noun and status; see status_labels.no_show. |
| `addons.names.credit` | Credit / Customer Due | ކްރެޑިޓް / ކަސްޓަމަރުގެ ދަރަނި | needs_review | Business terminology decision: ދަރަނި (debt) vs ކްރެޑިޓް. Spec requires 'Credit Sale / Customer Due / Outstanding Balance / Credit Payment' wording — please confirm Dhivehi equivalents before Phase 4. |
| `common.reset` | Reset | ފުރަތަމަ ހާލަތަށް | needs_review | Used on settings forms to discard unsaved edits. Alternative: ރީސެޓް. |
| `common.showing_range` | Showing {{from}}–{{to}} of {{total}} | {{total}} އިން {{from}}–{{to}} ދައްކަނީ | needs_review | Word order with numbers in RTL — please check it reads naturally. |
| `credit.all_time` | All time | ހުރިހާ މުއްދަތެއް | needs_review | Date-range preset; alternative: ފެށުނީއްސުރެ. |
| `credit.as_of` | As of | މި ތާރީޚަށް | needs_review | Shown next to a date; word order may need adjusting depending on layout (date follows label). |
| `credit.available` | Available credit | ލިބެން ހުރި ކްރެޑިޓް | needs_review | ލިބެން ހުރި ކްރެޑިޓް; alternative: ބޭނުންކުރެވޭ ކްރެޑިޓް. |
| `credit.balance` | Balance | ބާކީ | needs_review | Running ledger balance as ބާކީ. Same word is used for 'remaining' in POS; confirm no confusion. |
| `credit.balance_due` | Balance due | ދައްކަންޖެހޭ ބާކީ | needs_review | ދައްކަންޖެހޭ ބާކީ. Alternative: ދައްކަން ބާކީ އަދަދު. |
| `credit.credit` | Credit | ކްރެޑިޓް | needs_review | Ledger column. Loanword ކްރެޑިޓް chosen to pair with ޑެބިޓް; native alternative ލިބުނު (received). Note: elsewhere 'credit' as a sale/debt concept uses ދަރަނި, so the same English word maps to two Dhivehi words — confirm this split. |
| `credit.days` | Credit days | ކްރެޑިޓް ދުވަސް | needs_review | Literal 'credit days'. Alternative: ދަރަނި ދައްކަންޖެހޭ މުއްދަތު (ދުވަސް) — clearer but longer. |
| `credit.days_overdue_other` | {{count}} days overdue | މުއްދަތު ފަހަނައެޅިތާ {{count}} ދުވަސް | needs_review | Reuses print.days_overdue phrasing; Dhivehi has no plural split so _one and _other are identical. |
| `credit.debit` | Debit | ޑެބިޓް | needs_review | Ledger column loanword. Native alternative: ދަރަނި އިތުރުވި / ދައްކަންޖެހޭ. Confirm accountants' preferred term. |
| `credit.dues_report` | Customer dues report | ކަސްޓަމަރުންގެ ދަރަނީގެ ރިޕޯޓް | needs_review | Alternative: ކަސްޓަމަރުންގެ ބާކީ ރިޕޯޓް. Also printed on PDF given to staff/customers. |
| `credit.entry` | Entry | އެންޓްރީ | needs_review | Ledger entry loanword އެންޓްރީ. Alternative: ބަޔާން / ރެކޯޑު. |
| `credit.fifo_hint` | The payment is applied to the oldest unpaid credit sales first. | ފައިސާ ކެނޑޭނީ ފުރަތަމަ އެންމެ ކުރީގެ ނުދައްކާ ދަރަނީގެ ވިއްކުންތަކުން. | needs_review | FIFO allocation explanation; please check the phrasing ފައިސާ ކެނޑޭނީ (amount is deducted from) reads naturally. |
| `credit.grand_total` | Grand total | މުޅި ޖުމްލަ | needs_review | Distinguished from print.total (ޖުމްލަ). Alternative: ހުރިހާ ޖުމްލަ. |
| `credit.kinds.credit_sale` | Credit sale | ދަރަންޏަށް ވިއްކުން | needs_review | ދަރަންޏަށް ވިއްކުން — follows existing perm.credit_create. Depends on the credit-terminology decision. |
| `credit.limit` | Credit limit | ކްރެޑިޓް ލިމިޓް | needs_review | Matches existing perm.credit_manage (ކްރެޑިޓް ލިމިޓް). Alternative: ދަރަނީގެ ހަދު. Depends on the open credit-terminology decision in the existing review list. |
| `credit.outstanding` | Outstanding | ބާކީ ދަރަނި | needs_review | 'Outstanding' rendered as ބާކީ ދަރަނި (remaining debt). Alternatives: ދައްކަން ބާކީ, އައުޓްސްޓޭންޑިންގ. Also used in reports.columns.outstanding, reports.summary.outstanding, dashboard.w.outstanding_due. |
| `credit.page_title` | Credit & dues | ދަރަނި އަދި ދައްކަންޖެހޭ ފައިސާ | needs_review | Matches existing reports.types.credit. Alternative loanword: ކްރެޑިޓް އަދި ޑިއުސް. Depends on the pending ދަރަނި vs ކްރެޑިޓް decision (addons.names.credit). |
| `credit.statement` | Statement | ސްޓޭޓްމަންޓް | needs_review | Loanword ސްޓޭޓްމަންޓް, consistent with existing addons.descriptions.credit. Native alternative: ހިސާބު ބަޔާން. |
| `credit.total_due` | Total due | ދައްކަންޖެހޭ ޖުމްލަ | needs_review | Alternative: ޖުމްލަ ދަރަނި / ޖުމްލަ ބާކީ. Confirm which reads best on a dashboard tile. |
| `customers.overview` | Overview | ޚުލާޞާ | needs_review | ޚުލާޞާ (summary); alternative: އާންމު މަޢުލޫމާތު. |
| `dashboard.good_afternoon` | Good afternoon | މެންދުރު ފަހުގެ ސަލާމް | needs_review | Time-of-day greetings are not idiomatic in Dhivehi. Option: always show އައްސަލާމު ޢަލައިކުމް. |
| `dashboard.good_evening` | Good evening | ހަވީރުގެ ސަލާމް | needs_review | See dashboard.good_afternoon. |
| `dashboard.good_morning` | Good morning | ހެނދުނުގެ ސަލާމް | needs_review | See dashboard.good_afternoon. |
| `dashboard.w.kitchen_pending` | Kitchen tickets waiting | އިންތިޒާރުކުރާ ބަދިގޭގެ ޓިކެޓް | needs_review | 'Kitchen tickets' as ބަދިގޭގެ ޓިކެޓް (loanword). |
| `documents.server_totals_hint` | Totals are recalculated by the server when you save. | ސޭވްކުރާއިރު ޖުމްލަތައް ސާވަރުން އަލުން ހިސާބުކުރާނެ. | needs_review | Technical note mentioning the server (ސާވަރު, as in existing settings.hints.tax). |
| `documents.subtotal` | Subtotal | ސަބްޓޯޓަލް | needs_review | Loanword ސަބްޓޯޓަލް. Alternative: ޖުމްލަ (ޓެކްސް ނުލާ). |
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
| `karaoke.deposit` | Deposit (cash) | ޑިޕޮޒިޓް (ނަގުދު) | needs_review | Loanword ޑިޕޮޒިޓް, consistent with existing addons.descriptions.karaoke. |
| `karaoke.title` | Karaoke | ކަރައޮކޭ | needs_review | ކަރައޮކޭ — transliteration, consistent with existing addons.names.karaoke. |
| `kitchen.actions.ready` | Served | ކަސްޓަމަރަށް ދީފި | needs_review | 'Served' → ކަސްޓަމަރަށް ދީފި. Alternative: ސާވްކުރެވިއްޖެ / ހިލަ ދީފި. |
| `kitchen.rush` | Mark as rush | އަވަސް އޯޑަރެއްގެ ގޮތުގައި ފާހަގަކުރޭ | needs_review | 'Mark as rush' — އަވަސް އޯޑަރެއްގެ ގޮތުގައި ފާހަގަކުރޭ; may be long for a button. |
| `loyalty.points` | Points | ޕޮއިންޓް | needs_review | ޕޮއިންޓް — loanword, consistent with existing addons.descriptions.loyalty. |
| `modules.inventory` | Inventory | ސްޓޮކް | needs_review | Alternatives: އިންވެންޓަރީ, ގުދަން (storeroom). Chose ސްޓޮކް as the everyday word in shops. |
| `modules.invoices` | Invoices | އިންވޮއިސް | needs_review | Loanword used in Maldivian business. Alternative: ބިލު (but ބިލު is commonly a café/restaurant bill, which would clash with receipts). Business decision needed. |
| `modules.purchases` | Purchases | ގަތުން | needs_review | Alternative loanword: ޕާޗޭސް. |
| `modules.quotations` | Quotations | ކޮޓޭޝަން | needs_review | Loanword. Alternative: އަގު ހުށަހެޅުން. Which do your salespeople and customers actually use? |
| `modules.sales` | Sales | ވިއްކުން | needs_review | Alternative loanword: ސޭލްސް. ވިއްކުން reads naturally in reports; ސޭލްސް is common in POS UIs. |
| `nav.activity` | Activity log | ހަރަކާތްތަކުގެ ލޮގް | needs_review | Alternative: އޮޑިޓް ލޮގް. |
| `nav.open_pos` | Open POS | POS ހުޅުވާ | needs_review | Sidebar button; acronym kept in Latin per decision. |
| `nav.outlets` | Outlets | އައުޓްލެޓްތައް | needs_review | Alternatives: ބްރާންޗުތައް, ފިހާރަތައް. ބްރާންޗު may be clearer for multi-branch restaurants. |
| `notifications.empty` | You're all caught up. | އާ ނޮޓިފިކޭޝަނެއް ނެތް. | needs_review | Idiom 'You're all caught up' rendered literally as 'no new notifications'. |
| `notify.credit_payment` | {{customer}} paid {{amount}} towards credit | {{customer}} ދަރަންޏަށް {{amount}} ދައްކައިފި | needs_review | '{{customer}} ދަރަންޏަށް {{amount}} ދައްކައިފި' — check word order and verb. |
| `onboarding.title` | Get set up | ސެޓްއަޕް ކުރައްވާ | needs_review | 'Get set up' → ސެޓްއަޕް ކުރައްވާ. |
| `palette.actions` | Quick actions | އަވަސް ކަންތައްތައް | needs_review | Shortcut buttons on the dashboard; confirm wording. |
| `palette.placeholder` | Search or jump to… | ހޯދާ ނުވަތަ ސީދާ ދާ… | needs_review | UI phrase for the quick-search box; confirm natural wording. |
| `payment_methods.credit` | Credit (pay later) | ދަރަންޏަށް (ފަހުން ދައްކާ) | needs_review | ދަރަންޏަށް (ފަހުން ދައްކާ). Alternative: ކްރެޑިޓް (ފަހުން ދައްކާ). |
| `payments.kinds.credit_payment` | Credit payment | ދަރަނީގެ ފައިސާ | needs_review | ދަރަނީގެ ފައިސާ, matches existing perm.credit_payment wording. |
| `perm.credit_create` | Make credit sales | ދަރަންޏަށް ވިއްކާ | needs_review | Depends on the credit terminology decision above. |
| `perm.credit_view` | View customer due | ކަސްޓަމަރުންގެ ދަރަނި ބަލާ | needs_review | Depends on the credit terminology decision above. |
| `perm.loyalty_view` | View loyalty points | ލޮޔަލްޓީ ޕޮއިންޓް ބަލާ | needs_review | ލޮޔަލްޓީ ޕޮއިންޓް — consistent with existing addons.names.loyalty. Native alternative not common. |
| `pos.change_due` | Change | އަނބުރާ ދޭ ފައިސާ | needs_review | See print.change. |
| `pos.credit_to` | {{amount}} on credit to {{name}} | {{amount}} {{name}} ގެ ނަމުގައި ދަރަންޏަށް | needs_review | Word order reversed for Dhivehi: '{{amount}} {{name}} ގެ ނަމުގައި ދަރަންޏަށް'. Check it reads naturally with real values. |
| `pos.discount_short` | Disc. | ޑިސް. | needs_review | Abbreviation ޑިސް. — Dhivehi rarely abbreviates; could use full ޑިސްކައުންޓް if space allows. |
| `pos.hold` | Hold | ހިފަހައްޓާ | needs_review | 'Hold' (park order) as ހިފަހައްޓާ. Alternative: ފަހުން ނިންމަން ބަހައްޓާ. |
| `pos.order_types.dine_in` | Dine-in | ތިބެގެން ކެއުން | needs_review | ތިބެގެން ކެއުން (eat in). Alternative loanword: ޑައިން-އިން. Also used in errors.table_required, tables.empty_body, onboarding.steps.tables_hint, settings.pos.require_table. |
| `pos.redeem_points` | Redeem points (available: {{points}}) | ޕޮއިންޓް ބޭނުންކުރޭ (ލިބެން ހުރި: {{points}}) | needs_review | 'Redeem' rendered as ބޭނުންކުރޭ (use). Alternative: ބަދަލުކޮށްލާ / ރިޑީމްކުރޭ. |
| `print.bill_to` | Bill to | ބިލު ފޮނުވާ ފަރާތް | needs_review | 'Bill to' → ބިލު ފޮނުވާ ފަރާތް; alternative: ބިލު ދޫކުރާ ފަރާތް / ކަސްޓަމަރު. |
| `print.change` | Change | އަނބުރާ ދިން ފައިސާ | needs_review | Cash change as އަނބުރާ ދިން ފައިސާ; alternative: ބާކީ ފައިސާ (but ބާކީ is used for balance). |
| `print.charges` | Charges | ޗާޖުތައް | needs_review | Loanword consistent with ސަރވިސް ޗާޖު. These are debits (credit sales/invoices) on the statement; alternative: ދަރަނި އިތުރުވުން or ޑެބިޓް (as in credit.debit). |
| `print.closing_balance` | Closing balance | ނިމިގެންދާ ބާކީ | needs_review | Alternatives: ނިމުނު ބާކީ, ކްލޯޒިންގ ބެލެންސް. Keep parallel with print.opening_balance. |
| `print.days_overdue` | Days overdue | މުއްދަތު ފަހަނައެޅި ދުވަސް | needs_review | Built on status_labels.overdue (މުއްދަތު ފަހަނައަޅާފައި), itself still needs_review. Alternative aligned with superadmin past_due: ލަސްވި ދުވަސް. |
| `print.invoice` | Invoice | އިންވޮއިސް | needs_review | އިންވޮއިސް — reused; still open in existing review (modules.invoices). |
| `print.open_items` | Unpaid items | ނުދައްކާ އައިޓަމްތައް | needs_review | 'Items' here means unpaid sales/invoices, not menu items. Alternative: ނުދައްކާ ބިލުތައް / ނުދައްކާ މުޢާމަލާތް. |
| `print.opening_balance` | Opening balance | ފެށިގެންދާ ބާކީ | needs_review | ބާކީ as in credit.balance. Alternatives: ފެށުނު ބާކީ, އޯޕަނިންގ ބެލެންސް (loanword used by some accountants). |
| `print.overdue_amount` | Overdue | މުއްދަތު ފަހަނައަޅާފައި | needs_review | Same as status_labels.overdue; used as an amount column header, so ފައިސާ ލަސްވެފައި might fit better. |
| `print.payments` | Payments | ދެއްކި ފައިސާ | needs_review | Alternative: ލިބުނު ފައިސާ (customer-facing vs business view — this PDF goes to the customer, so 'paid' wording chosen). |
| `print.pdf_failed` | Could not create the PDF. Try Print → Save as PDF instead. | PDF ހެދޭނެ ނުވި. އޭގެ ބަދަލުގައި ޕްރިންޓް → PDF ގެ ގޮތުގައި ސޭވްކުރޭ ބޭނުންކޮށްލާ. | needs_review | 'Save as PDF' is a browser dialog label that will likely appear in English; consider keeping it in Latin ('Save as PDF'). |
| `print.prepared_for` | Prepared for | ތައްޔާރުކުރީ | needs_review | Rendered as ތައްޔާރުކުރީ (prepared for — name follows). Alternative: މި ފަރާތަށް ތައްޔާރުކުރީ. Check layout with name. |
| `print.quotation` | Quotation | ކޮޓޭޝަން | needs_review | ކޮޓޭޝަން — reused; still open in existing review (modules.quotations). |
| `print.statement` | Statement of account | ހިސާބުގެ ސްޓޭޓްމަންޓް | needs_review | Uses the loanword ސްޓޭޓްމަންޓް (as in credit.statement). Native alternative: ހިސާބު ބަޔާން. Confirm which reads better as a PDF title. |
| `print.total_outstanding` | Total outstanding | ޖުމްލަ ބާކީ ދަރަނި | needs_review | Follows credit.outstanding = ބާކީ ދަރަނި (needs_review there). |
| `products.cost_price` | Cost price | ކޮސްޓް އަގު | needs_review | ކޮސްޓް އަގު (loanword). Alternative: ގަތް އަގު (purchase price). |
| `products.item` | Item | އައިޓަމް | needs_review | 'Item' as loanword އައިޓަމް across the file. Existing dv.json uses ޕްރޮޑަކްޓްސް for products and ތަކެތި for goods; alternatives: ބާވަތް, ތަކެތި. Confirm. |
| `products.min_stock` | Low-stock alert at | ސްޓޮކް މަދުވާ އެލާޓް | needs_review | 'Low-stock alert at' → ސްޓޮކް މަދުވާ އެލާޓް (threshold field label). Confirm. |
| `products.photo_hint` | Shown on the POS and the QR menu. Any phone or camera photo works; it is resized automatically. | POS އާއި QR މެނޫގައި ދައްކާނެ. ފޯނު ނުވަތަ ކެމެރާގެ ކޮންމެ ފޮޓޯއެއް ވެސް ބޭނުންކުރެވޭނެ؛ ސައިޒު އަމިއްލައަށް ހަމަޖެހޭނެ. | needs_review | New help text under the product photo picker; confirm natural wording. |
| `products.recipe_cost` | Cost per portion | ކޮންމެ ޕޯޝަނެއްގެ ޚަރަދު | needs_review | ކޮންމެ ޕޯޝަނެއްގެ ޚަރަދު; 'portion' loanword ޕޯޝަން — alternative: ބައި / ޕްލޭޓް. |
| `products.sku` | SKU | SKU | needs_review | އެސްކޭޔޫ transliteration. Users may prefer Latin SKU or ކޯޑު. |
| `products.types.ingredient` | Ingredient | ތަކެތި (އިންގްރީޑިއަންޓް) | needs_review | ތަކެތި (އިންގްރީޑިއަންޓް). ތަކެތި alone is ambiguous (things/goods); alternative: ކާނާގެ ތަކެތި / އަސާސީ ތަކެތި. |
| `products.unit` | Unit | ޔުނިޓް | needs_review | Loanword ޔުނިޓް; alternative: މިންވަރު. |
| `public_menu.not_found_body` | This menu does not exist or is not published. | މި މެނޫ ނެތް ނުވަތަ ޝާއިޢުކޮށްފައެއް ނެތް. | needs_review | 'published' as ޝާއިޢުކޮށް; also settings.online.menu_enabled (މެނޫ ޝާއިޢުކުރޭ). Alternative: ޕަބްލިޝް. |
| `quotations.convert` | Convert to invoice | އިންވޮއިސްއަކަށް ބަދަލުކުރޭ | needs_review | އިންވޮއިސްއަކަށް ބަދަލުކުރޭ follows existing perm.quotations_convert_to_invoice. |
| `quotations.valid_until` | Valid until | ޞައްޙަ ތާރީޚު | needs_review | ޞައްޙަ ތާރީޚު (valid-until date), based on existing settings.validity_days. Alternative: ޞައްޙަ ވާނީ މި ތާރީޚާ ހަމައަށް. |
| `reports.columns.gross` | Gross | ގްރޮސް | needs_review | Loanword ގްރޮސް; alternative: ޖުމްލަ (ޑިސްކައުންޓް ކުރިން). |
| `reports.columns.margin` | Margin | މާޖިން | needs_review | Loanword މާޖިން. Alternative: ފައިދާގެ މިންވަރު. |
| `reports.export_csv` | Export CSV | CSV އެކްސްޕޯޓްކުރޭ | needs_review | ސީއެސްވީ transliteration. |
| `reports.rows_count_other` | {{count}} rows | {{count}} ރޯ | needs_review | Loanword ރޯ (row). Dhivehi has no plural inflection after numerals; alternative: {{count}} ލައިން. |
| `reports.summary.cogs` | Cost of goods | ވިއްކި ތަކެތީގެ ކޮސްޓް | needs_review | Cost of goods: ވިއްކި ތަކެތީގެ ކޮސްޓް. Confirm with accountant. |
| `reports.summary.grossProfit` | Gross profit | ގްރޮސް ފައިދާ | needs_review | ގްރޮސް ފައިދާ (mixed loanword). Alternative: ޚަރަދު ކުރިން ފައިދާ. |
| `reports.summary.netProfit` | Net profit | ނެޓް ފައިދާ | needs_review | ނެޓް ފައިދާ. Alternative: ޞާފު ފައިދާ. |
| `reports.types.costing` | Recipe costing | ރެސިޕީގެ ޚަރަދު | needs_review | Recipe costing as ރެސިޕީގެ ޚަރަދު. Existing addons.names.ingredient_costing uses ތަކެތީގެ ޚަރަދު ހިސާބުކުރުން. Note: report columns use loanword ކޮސްޓް for cost of goods while ޚަރަދު is reserved for expenses — confirm this split. |
| `reports.types.credit` | Credit & dues | ދަރަނި އަދި ދައްކަންޖެހޭ ފައިސާ | needs_review | Credit & dues: ދަރަނި އަދި ދައްކަންޖެހޭ ފައިސާ. |
| `reports.types.profit` | Profit & loss | ފައިދާއާއި ގެއްލުން | needs_review | Profit & loss: ފައިދާއާއި ގެއްލުން — standard phrase, but please confirm. |
| `reservations.party_other` | {{count}} guests | {{count}} މެހެމާނުން | needs_review | Guests as މެހެމާނުން; singular form މެހެމާނަކު used for _one. Alternative: ގެސްޓުން. |
| `reservations.title` | Reservations | ރިޒަވޭޝަންތައް | needs_review | Loanword ރިޒަވޭޝަން, consistent with existing addons.names.reservations. Native alternative: މޭޒު ބުކްކުރުން. |
| `roles.system.business_admin` | Business Admin | ބިޒްނަސް އެޑްމިން | needs_review | Alternative: ވިޔަފާރީގެ އެޑްމިން. |
| `roles.system.salesperson` | Salesperson | ސޭލްސް ޕާސަން | needs_review | Alternative: ވިއްކާ މުވައްޒަފު. |
| `roles.title` | Roles & permissions | ރޯލްތަކާއި ހުއްދަތައް | needs_review | ހުއްދަ for 'permission' is natural Dhivehi; some staff may expect the loanword ޕަމިޝަން. |
| `sales.void` | Void | ބާތިލުކުރޭ | needs_review | ބާތިލުކުރޭ follows existing perm.sales_void / invoices_void. Note 'cancel' uses the loanword ކެންސަލް, so void vs cancel stay distinct; confirm. |
| `sales.void_hint` | Stock is returned and payments are reversed. This cannot be undone. | ސްޓޮކް އަނބުރާ އިތުރުވެ، ދެއްކި ފައިސާ އަނބުރާ ރިވާސްވާނެ. މިކަން އަނބުރާ ނުކުރެވޭނެ. | needs_review | 'payments are reversed' rendered with loanword ރިވާސްވާނެ. Alternative: ދެއްކި ފައިސާ އަނބުރާ ބާތިލުވާނެ. |
| `settings.hints.pos` | How the point of sale behaves. | ޕޮއިންޓް އޮފް ސޭލް ހިނގާނެ ގޮތް. | needs_review | 'Point of sale' transliterated ޕޮއިންޓް އޮފް ސޭލް. Alternative: ވިއްކާ ސިސްޓަމް. |
| `settings.loyalty.points_per_unit` | Points per 1 currency unit spent | ޚަރަދުކުރާ ކޮންމެ 1 ފައިސާ ޔުނިޓަކަށް ލިބޭ ޕޮއިންޓް | needs_review | Long phrasing; check clarity. |
| `settings.pos.allow_negative_stock` | Allow selling when out of stock | ސްޓޮކް ނެތްއިރުވެސް ވިއްކުމުގެ ހުއްދަ | needs_review | Check phrasing: ސްޓޮކް ނެތްއިރުވެސް ވިއްކުމުގެ ހުއްދަ. |
| `status_labels.available` | Available | ހުސް | needs_review | Table status: ހުސް (free). If also shown for products, ލިބެން ހުރި would fit better. |
| `status_labels.issued` | Issued | ނެރެފައި | needs_review | ނެރެފައި — see invoices.issue. |
| `status_labels.no_show` | No-show | ނާދޭ | needs_review | ނާދޭ (did not come). Alternative loanword: ނޯ-ޝޯ. |
| `status_labels.occupied` | Occupied | ބޭނުންކުރަމުން | needs_review | Table status: ބޭނުންކުރަމުން; alternative: ހުސްނޫން. |
| `status_labels.overdue` | Overdue | މުއްދަތު ފަހަނައަޅާފައި | needs_review | މުއްދަތު ފަހަނައަޅާފައި. Existing superadmin uses ފައިސާ ލަސްވެފައި for past_due; consider aligning. |
| `status_labels.rejected` | Rejected | ރިޖެކްޓްކޮށްފައި | needs_review | Loanword ރިޖެކްޓް. Native alternative: ގަބޫލުނުކުރެވި / ރައްދުކުރެވި. Same choice used across quotations/online orders. |
| `status_labels.seated` | Seated | އިށީނދެފައި | needs_review | އިށީނދެފައި (seated); alternative: މޭޒަށް ވަޑައިގެންފި. |
| `status_labels.void` | Void | ބާތިލު | needs_review | ބާތިލު (void) vs ކެންސަލްކޮށްފައި (cancelled) — keep the two distinct. |
| `status.pending_title` | Awaiting approval | އެޕްރޫވަލަށް އިންތިޒާރުކުރަނީ | needs_review | Alternative with native vocabulary: ހުއްދައަށް އިންތިޒާރުކުރަނީ. |
| `superadmin.business.enable` | Enable | ހުޅުވާ | needs_review | Matches common.enabled (ހުޅުވިފައި). Alternative: އެނޭބަލްކުރޭ. |
| `superadmin.dashboard.mrr` | Monthly recurring revenue | މަހުން މަހަށް ލިބޭ އާމްދަނީ | needs_review | Financial term; confirm wording. |
| `superadmin.security.two_factor` | Two-factor authentication | ދެ ފިޔަވަޅުގެ ވެރިފިކޭޝަން | needs_review | Literal; '2FA' loanword may be clearer to admins. |
| `superadmin.status.suspended` | Suspended | ހުއްޓާލާފައި | needs_review | Alternative: ސަސްޕެންޑްކޮށްފައި. |
| `time.minutes_ago` | {{count}} minutes ago | {{count}} މިނެޓު ކުރިން | needs_review | Relative time phrasing used in lists (e.g. last sign-in). Confirm natural word order. |
| `validation.too_many` | Select at most {{max}}. | {{max}} އަށްވުރެ ގިނަ ނުހޮވާށެވެ. | needs_review | Formal written ending; other messages use a polite conversational tone. |
| `viber.on` | ON | ON | needs_review | Kept in Latin; alternative ހުޅުވާ is longer for a switch label. |
| `viber.status_off` | Viber notifications are disabled. Credit transactions will continue normally. | Viber ނޯޓިފިކޭޝަން ބަންދުކޮށްފައި. ދަރަނީގެ މުޢާމަލާތްތައް އާދައިގެ ގޮތުގައި ކުރިއަށް ދާނެ. | needs_review | ބަންދު matches common.disabled. Same notification-term question as status_on. |
| `viber.status_on` | Viber notifications will be sent for Credit (Pay Later) transactions when the customer has a registered Viber number. | ކަސްޓަމަރުގެ Viber ނަންބަރު ރަޖިސްޓަރީކޮށްފައިވާނަމަ، ދަރަންޏަށް (ފަހުން ދައްކާ) ކުރާ މުޢާމަލާތްތަކަށް Viber ނޯޓިފިކޭޝަން ފޮނުވޭނެ. | needs_review | Loanword ނޯޓިފިކޭޝަން used; alternative: އެންގުން / ހަބަރު. Confirm preferred term. |
| `documents.service_charge` | Service charge | ސަރވިސް ޗާޖު | confirmed | ސަރވިސް ޗާޖު — confirmed in existing review list. |
| `documents.tax` | Tax | ޓެކްސް | confirmed | ޓެކްސް — standard, matches existing. |
| `documents.total` | Total | ޖުމްލަ | confirmed | ޖުމްލަ — standard. |
| `expenses.categories.electricity` | Electricity | ކަރަންޓް | confirmed | ކަރަންޓް — standard everyday term. |
| `expenses.categories.rent` | Rent | ކުލި | confirmed | ކުލި — standard. |
| `expenses.categories.salaries` | Salaries | މުސާރަ | confirmed | މުސާރަ — standard. |
| `nav.pos` | POS | POS | confirmed | Business decision: acronyms (POS, QR, SKU, CSV) stay in Latin letters inside Dhivehi text, matching hardware labels and receipts. |
| `payment_methods.card` | Card | ކާޑު | confirmed | ކާޑު — standard. |
| `payment_methods.cash` | Cash | ނަގުދު | confirmed | ނަގުދު — standard. |
| `perm.qr_menu_manage` | Manage QR menu | QR މެނޫ މެނޭޖްކުރޭ | confirmed | Business decision: acronyms (POS, QR, SKU, CSV) stay in Latin letters inside Dhivehi text, matching hardware labels and receipts. |
| `pos.order_types.takeaway` | Takeaway | ޓޭކްއަވޭ | confirmed | ޓޭކްއަވޭ — matches existing business_types.takeaway. |
| `print.cashier` | Cashier | ކެޝިއަރު | confirmed | ކެޝިއަރު — confirmed in existing review list. |
| `print.receipt` | Receipt | ރަސީދު | confirmed | ރަސީދު — confirmed in existing review list. |
| `print.thank_you` | Thank you! | ޝުކުރިއްޔާ! | confirmed | ޝުކުރިއްޔާ — standard. |
| `products.types.service` | Service | ޚިދުމަތް | confirmed | ޚިދުމަތް is the standard word for service. |
| `roles.system.cashier` | Cashier | ކެޝިއަރު | confirmed |  |
| `roles.system.kitchen_staff` | Kitchen Staff | ބަދިގޭގެ މުވައްޒަފު | confirmed |  |
| `roles.system.waiter` | Waiter | ވެއިޓަރު | confirmed |  |
| `settings.service_charge_enabled` | Apply service charge | ސަރވިސް ޗާޖު ނަގާ | confirmed | ސަރވިސް ޗާޖު is the common term on Maldivian bills. |
| `settings.tabs.receipt` | Receipts | ރަސީދު | confirmed | Standard term. |
| `system.faruma_missing` | The Faruma font is not installed, so Dhivehi text may not display correctly. | ފަރުމާ ފޮންޓް އިންސްޓޯލްކޮށްފައި ނުވާތީ ދިވެހި ލިޔުން ރަނގަޅަށް ނުފެނިދާނެ. | confirmed |  |
| `tables.seats_other` | {{count}} seats | {{count}} ގޮނޑި | confirmed | ގޮނޑި — standard (chair/seat). |
| `users.owner` | Owner | ވެރިފަރާތް | confirmed |  |
