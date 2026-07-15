# Apprentice Atlas — App Store readiness

Last reviewed: 15 July 2026

## Implemented in the app

- Browsing works without an account. Login is required only for saved opportunities and application tracking.
- Location permission is requested only when the user chooses nearby search; country/city selection remains available.
- Sign in with Apple and email magic-link authentication are available.
- Settings contains localized privacy policy, terms, legal notice, support contact, version information, data export, sign out, and permanent in-app account deletion.
- Account deletion is authenticated server-side, removes private Storage objects, and then deletes the Supabase Auth user. Favorites and applications use `ON DELETE CASCADE`.
- For Apple-authenticated accounts, the current native ID-token flow does not retain an Apple refresh token. The deletion confirmation therefore follows Apple TN3194's manual fallback and tells the user how to revoke Apprentice Atlas in Apple ID settings after deleting all app data. If Apple refresh-token storage is added later, replace this fallback with Apple's `/auth/revoke` REST call.
- AI content is clearly supplemental to the official listing. AI requests use `store: false`, and the app warns against sharing sensitive information.
- The iOS privacy manifest declares required-reason APIs, collected-data categories, and no tracking.
- The encryption declaration is set to `ITSAppUsesNonExemptEncryption: false` because the app only uses standard platform/network encryption.

## App Store Connect checklist

Complete these items before submitting a build:

1. Publish a dedicated, publicly accessible Apprentice Atlas privacy page. Use that URL in **App Privacy → Privacy Policy URL**. The current company policy is `https://estopia.net/privacy`; an app-specific page should mirror the in-app policy.
2. Set **Support URL** to `https://estopia.net/contact` and verify the page shows a working support contact.
3. Complete the App Privacy questionnaire consistently with `app.json`:
   - Contact Info: Name, Email Address — linked to identity; App Functionality.
   - Identifiers: User ID — linked to identity; App Functionality.
   - Location: Precise Location — linked conservatively; App Functionality.
   - User Content: Other User Content — linked; App Functionality (application notes and AI questions).
   - Usage Data: Product Interaction — linked; App Functionality (saved jobs and application status).
   - Tracking: No. Advertising: No.
4. Complete the age-rating questionnaire honestly. The app targets teenagers but is not a Kids Category app, contains no user-to-user communication, and links to external job listings.
5. Confirm content rights for displaying listings from the Bundesagentur für Arbeit and Find an apprenticeship APIs, and describe the official sources in review notes.
6. Confirm Sign in with Apple capability and Supabase redirect URLs for the production bundle identifier.
7. Add representative iPhone and iPad screenshots if `supportsTablet` remains enabled. Otherwise explicitly disable tablet support before submission.
8. Add review notes and a working test account only if the reviewer needs authenticated-state testing. Reviewers can browse without an account.
9. Confirm the build’s export-compliance answer matches `ITSAppUsesNonExemptEncryption: false`.
10. Verify all links, account deletion, data export, Apple sign-in, location denial, and manual-location fallback on the submitted build.

## Suggested App Review notes

> Apprentice Atlas is a map-first apprenticeship discovery app for Germany and the United Kingdom. Browsing and manual location search work without an account. Authentication is only needed to save opportunities or track an application. The Settings screen includes Privacy, Terms, Legal Notice, data export, and permanent account deletion. Location is optional and has a manual fallback. Listings come from official government APIs and applications open the official provider page. AI explanations are grounded in the listing and are supplemental; the original listing remains visible.

## Legal notes

- Apple’s standard EULA applies unless a custom EULA is added in App Store Connect. The in-app Terms explain product-specific usage and limitations.
- Legal text should be reviewed by qualified counsel before commercial launch, especially children’s consent, international transfers, retention periods, and governing-law language.
- Keep the in-app policy, public privacy URL, App Privacy answers, and actual implementation synchronized whenever data handling changes.
