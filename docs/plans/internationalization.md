# Internationalization

The app selects one translation catalog per language. English is the default; Portuguese is also supported. The device locale supplies the initial language, and users can change it in Settings. Each new language supplies one set of plain strings. Missing or length-constrained strings fall back to English, and parameters are interpolated at runtime.

Legacy saved tone preferences are ignored and removed from settings on upgrade. Previously scheduled notifications retain their original content; newly scheduled reminders use the current language catalog.
