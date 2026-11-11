import type { TranslationKey } from "./en";

export const enSassy: Partial<Record<TranslationKey, string>> = {
  "app.error.openTitle": "Wow. It broke.",
  "app.error.openDescription": "Go on, try again.",
  "app.error.retry": "Fix it",

  "common.couldNotSaveSettings": "Couldn’t save. Shocking.",
  "common.tryAgain": "Try harder",

  "settings.ownerNameRequired": "You need a name. Any name.",
  "settings.defaultCurrencyRequired": "Money exists. Pick a currency.",

  "settings.trackPayments.title": "Track who’s broke",
  "settings.balanceHelper.title": "Debt watcher",

  "home.startSplit": "Start something you’ll regret",
  "home.noSplitsTitle": "Empty. Like your wallet soon.",
  "home.noSplitsDescription": "Splits will show up here. Eventually.",
  "home.noSplitsFilteredTitle": "Still nothing. Impressive.",
  "home.undoSplitDeleted": "Gone. Hope that was intentional.",
  "home.youAreOwed": "They owe you. Good luck.",
  "home.youOwe": "You owe. Pay up.",

  "flow.setup.next": "Next: find people to blame",

  "flow.participants.title": "Who’s responsible for this?",
  "flow.participants.add": "Add another victim",
  "flow.participants.next": "Next: who paid (probably not you)",

  "flow.payer.title": "Who actually paid?",
  "flow.payer.next": "Next: list the damage",

  "flow.items.title": "What did you waste money on?",
  "flow.items.import": "Let AI clean your mess",
  "flow.items.addManual": "Do it the hard way",
  "flow.items.itemDeleted": "Deleted. Like it never happened.",
  "flow.items.runningTotal": "Total damage",

  "flow.itemDetail.editTitle": "Fix your mistake",
  "flow.itemDetail.nameRequired": "Name it. It’s not that hard.",
  "flow.itemDetail.priceRequired": "Numbers. We need numbers.",
  "flow.itemDetail.confirmDiscard.title": "Give up already?",
  "flow.itemDetail.confirmDelete.title": "Delete it and pretend it’s fine?",

  "flow.splitItem.title": "Who’s paying for this mess?",
  "flow.splitItem.confirmNext": "Save and move on",
  "flow.splitItem.confirmReview": "Save and judge everyone",

  "flow.import.askAiTitle": "Let AI do your job",
  "flow.import.afterAi": "Copy it properly this time",
  "flow.import.copyPrompt": "Copy it. Carefully.",
  "flow.import.alreadyHaveList": "Sure you do",

  "flow.review.title": "Last chance to fix this",
  "flow.overview.finalize": "Lock it in",

  "flow.results.title": "Here’s the damage",
  "flow.results.invalidTitle": "This makes no sense",
  "flow.results.totalSettled": "All settled. Finally.",
  "flow.results.markPaid": "Mark as paid (if true)",
  "flow.results.revertMarkPaid": "Undo that lie",

  "validation.participantsMin": "You need at least two people. Basic stuff.",
  "validation.payerRequired": "Someone had to pay. Pick one.",
  "validation.itemsMin": "No items? What are we doing here?",
  "validation.itemAmountInvalid": "That number is not it",
  "validation.percentTotal": "Make it 100. Not 99. Not 101.",

  "friendly.itemsMin": "Add something before continuing",
  "friendly.percentTotal": "It needs to be exactly 100",

  "clipboard.payer.getBack": "{name}: paid {amount}, consumed {consumed}, should get back {net}.",
  "clipboard.payer.stillOwes": "{name}: paid {amount}, consumed {consumed}, still owes {net}.",
  "clipboard.person.owes": "{name}: owes {amount}",
  "clipboard.person.getsBack": "{name}: gets back {amount}",
  "reminders.notification.splitBody":
    "Nudge: this split still needs attention.",
  "reminders.notification.debtBodyNamed":
    "{name} still has an open amount. Time to poke them.",
  "reminders.notification.debtBodyUnnamed":
    "Someone still has an open amount. Go poke them.",

  "pdf.invalid": "No PDF. Fix your split first.",
};

export const enUnhinged: Partial<Record<TranslationKey, string>> = {
  "app.error.openTitle": "You broke it.",
  "app.error.openDescription": "Do it again. But better.",
  "app.error.retry": "Redeem yourself",
  "common.couldNotSaveSettings": "Settings not saved. Try caring more.",
  "common.tryAgain": "Again. With effort.",
  "settings.ownerNameRequired": "No name? Bold strategy.",
  "settings.defaultCurrencyRequired": "Pick a currency. This isn’t Monopoly.",
  "settings.trackPayments.title": "Track the freeloaders",
  "settings.balanceHelper.title": "Debt scoreboard",
  "home.startSplit": "Start financial drama",
  "home.noSplitsTitle": "Nothing here. Suspicious.",
  "home.noSplitsDescription": "Don’t worry, chaos is coming.",
  "home.noSplitsFilteredTitle": "Still empty. Impressive.",
  "home.undoSplitDeleted": "Gone. Like your money soon.",
  "home.youAreOwed": "They owe you. Chase them.",
  "home.youOwe": "You owe. Pay up.",
  "flow.setup.next": "Next: assemble the suspects",
  "flow.participants.title": "Who’s involved in this disaster?",
  "flow.participants.add": "Add another accomplice",
  "flow.participants.next": "Next: who got stuck paying",
  "flow.payer.title": "Who was the sugar daddy?",
  "flow.payer.next": "Next: list your bad decisions",
  "flow.items.title": "What did you waste money on?",
  "flow.items.import": "Let AI deal with this mess",
  "flow.items.addManual": "Fine, do it yourself",
  "flow.items.itemDeleted": "Deleted. Just like that.",
  "flow.items.runningTotal": "Total damage so far",
  "flow.itemDetail.editTitle": "Fix your mess",
  "flow.itemDetail.nameRequired": "Name it. It’s not invisible.",
  "flow.itemDetail.priceRequired": "Numbers. We need numbers.",
  "flow.itemDetail.confirmDiscard.title": "Rage quit?",
  "flow.itemDetail.confirmDelete.title": "Delete and pretend it never existed?",
  "flow.splitItem.title": "Who’s paying for this nonsense?",
  "flow.splitItem.confirmNext": "Lock it and move on",
  "flow.splitItem.confirmReview": "Lock it and judge",
  "flow.import.askAiTitle": "Let AI save you",
  "flow.import.afterAi": "Copy it correctly this time",
  "flow.import.copyPrompt": "Copy it. Don’t mess it up.",
  "flow.import.alreadyHaveList": "Sure you do",
  "flow.review.title": "Last chance to not embarrass yourself",
  "flow.overview.finalize": "Make it official. No takebacks.",
  "flow.results.title": "Here’s the damage",
  "flow.results.invalidTitle": "This makes zero sense",
  "flow.results.totalSettled": "Finally. Peace.",
  "flow.results.markPaid": "Mark as paid (be honest)",
  "flow.results.revertMarkPaid": "Undo that lie",
  "validation.participantsMin":
    "You need at least two people. This isn’t solo mode.",
  "validation.payerRequired": "Someone paid. Admit it.",
  "validation.itemsMin": "No items? Then why are you here?",
  "validation.itemAmountInvalid": "That number is illegal",
  "validation.percentTotal": "Make it 100. It’s not optional.",
  "friendly.itemsMin": "Add something before wasting more time",
  "friendly.percentTotal": "It must be exactly 100. Not close.",
  "clipboard.payer.getBack": "{name}: paid {amount}, consumed {consumed}, better get back {net}.",
  "clipboard.payer.stillOwes": "{name}: paid {amount}, consumed {consumed}, still in debt {net}.",
  "clipboard.person.owes": "{name}: owes {amount}. Pay them.",
  "clipboard.person.getsBack": "{name}: gets back {amount}. Eventually.",
  "reminders.notification.splitBody":
    "This split is still open. Handle it before it haunts you.",
  "reminders.notification.debtBodyNamed":
    "{name} still owes money. Summon the payment.",
  "reminders.notification.debtBodyUnnamed":
    "A participant still owes money. Summon the payment.",
  "pdf.invalid": "No PDF for this mess. Fix it first.",
};
