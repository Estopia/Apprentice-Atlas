import type { Locale } from './i18n';

export type LegalDocumentId = 'privacy' | 'terms' | 'imprint' | 'about';
export type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };
export type LegalDocument = { title: string; updated?: string; intro: string; sections: LegalSection[]; externalUrl?: string };

const company = {
  name: 'Estopia Engineering Ltd',
  number: 'SC874827',
  vat: 'GB511047931',
  address: '3 Braemount, Cowdenbeath, KY4 9RB, United Kingdom',
  email: 'hello@estopia.net',
  phone: '+44 3330 068281',
};

const documents: Record<Locale, Record<LegalDocumentId, LegalDocument>> = {
  de: {
    privacy: {
      title: 'Datenschutzerklärung', updated: '15. Juli 2026', externalUrl: 'https://estopia.net/privacy',
      intro: 'Diese Erklärung beschreibt verständlich, welche Daten Apprentice Atlas verarbeitet und welche Rechte du hast.',
      sections: [
        { heading: 'Verantwortlicher', paragraphs: [`${company.name}, ${company.address}. Kontakt: ${company.email}, ${company.phone}.`] },
        { heading: 'Welche Daten wir verarbeiten', paragraphs: ['Du kannst Stellen ohne Konto durchsuchen. Wenn du ein Konto nutzt, verarbeiten wir deine E-Mail-Adresse, eine interne Nutzer-ID, optional den von Apple übermittelten Namen sowie gespeicherte Chancen, Bewerbungsstatus und freiwillige Notizen.'], bullets: ['Suchland, Sprache, Interessen und Ausgangslage werden auf deinem Gerät gespeichert.', 'Dein genauer Standort wird nur nach deiner Zustimmung für die Umkreissuche verwendet. Du kannst immer einen Ort manuell auswählen.', 'Fragen an die KI werden zur Beantwortung verarbeitet, aber nicht in deinem Apprentice-Atlas-Konto gespeichert.', 'Für die persönliche KI-Vorbereitung kannst du freiwillig deinen Hintergrund und deine Stärken eingeben. Ein lokaler Entwurf bleibt auf deinem Gerät; für jede Analyse wird der Inhalt nur vorübergehend verarbeitet.'] },
        { heading: 'Warum und auf welcher Grundlage', paragraphs: ['Wir verarbeiten Kontodaten und deine gespeicherten Inhalte, um die von dir angeforderten App-Funktionen bereitzustellen. Den Gerätestandort verwenden wir nur nach deiner Einwilligung. Du kannst die Standortfreigabe in iOS jederzeit widerrufen und die manuelle Suche nutzen.'] },
        { heading: 'Dienste und Empfänger', paragraphs: ['Supabase stellt Anmeldung, Datenbank und Serverfunktionen bereit. Kontodaten werden in der EU-Region verarbeitet. OpenAI verarbeitet Stelleninhalte, deine freiwilligen Fragen und den für eine persönliche Vorbereitung übermittelten Hintergrund nur zur angeforderten Ausgabe; API-Anfragen verwenden store: false, damit die Speicherung bei OpenAI deaktiviert ist. Apple verarbeitet Daten, wenn du „Mit Apple anmelden“ nutzt. Beim Öffnen einer offiziellen Anzeige gelten die Hinweise des jeweiligen Stellenanbieters.'] },
        { heading: 'Gerätefunktionen und Exporte', paragraphs: ['Präferenzen, der lokale Profilentwurf und Benachrichtigungs-IDs für Fristerinnerungen liegen gerätebezogen vor und werden nicht mit deinem Konto synchronisiert. Wenn du einen Termin an den Kalender übergibst, öffnet Apprentice Atlas die native Kalenderfunktion mit Titel und Datum; anschließend verarbeitet dein Kalenderanbieter diese Daten. Share-Grafiken werden lokal aus Titel, Unternehmen, Ort, Quelle und App-Link erzeugt und erst durch deine Teilen-Auswahl weitergegeben. Der PDF-Export wird lokal aus ausgewählten Kontodaten erstellt; vollständige Anzeigentexte, Authentifizierungsdaten, Benachrichtigungs-IDs und der Profilentwurf sind ausgeschlossen. Der JSON-Export bleibt separat verfügbar.'] },
        { heading: 'Speicherdauer und Löschung', paragraphs: ['Kontodaten, gespeicherte Chancen und Bewerbungsnotizen bleiben bestehen, bis du sie entfernst oder dein Konto löschst. Über „Einstellungen → Konto löschen“ kannst du dein Konto und die zugehörigen aktiven Daten dauerhaft entfernen. Sicherungskopien laufen nach den Aufbewahrungsfristen unserer Dienstleister aus. Öffentliche, aus Stellenanzeigen erzeugte Erklärungen enthalten keine Kontodaten.'] },
        { heading: 'Deine Rechte', paragraphs: [`Du kannst Auskunft, Berichtigung, Löschung, Einschränkung und Datenübertragbarkeit verlangen sowie einer Verarbeitung widersprechen. Kontaktiere ${company.email}. Du kannst dich außerdem bei der zuständigen Datenschutzaufsicht beschweren.`] },
        { heading: 'Jugendliche', paragraphs: ['Die App richtet sich an Schüler:innen und junge Erwachsene, fragt aber kein Geburtsdatum ab. Gib keine sensiblen persönlichen Daten in Bewerbungsnotizen oder KI-Fragen ein. Wenn das Recht an deinem Wohnort die Zustimmung einer sorgeberechtigten Person verlangt, nutze die App bitte gemeinsam mit ihr.'] },
        { heading: 'Tracking', paragraphs: ['Wir verwenden derzeit keine Werbung, keine Werbe-IDs und keine Drittanbieter-Analytics zum Tracking über Apps oder Websites hinweg.'] },
      ],
    },
    terms: {
      title: 'Nutzungsbedingungen', updated: '15. Juli 2026', externalUrl: 'https://estopia.net/terms',
      intro: 'Mit der Nutzung von Apprentice Atlas stimmst du diesen Bedingungen zu.',
      sections: [
        { heading: 'Wofür die App da ist', paragraphs: ['Apprentice Atlas hilft dir, Ausbildungs- und Einstiegsstellen zu entdecken und deinen Bewerbungsweg zu organisieren. Die App vermittelt keine Beschäftigung und ersetzt keine Berufs-, Rechts- oder Finanzberatung.'] },
        { heading: 'Stellenanzeigen und Bewerbungen', paragraphs: ['Anzeigen stammen aus offiziellen externen Quellen. Die jeweilige Originalquelle ist maßgeblich für Inhalt, Fristen, Verfügbarkeit und Bewerbung. Wir können nicht garantieren, dass jede Anzeige vollständig, aktuell oder fehlerfrei ist. Bewerbungen erfolgen beim externen Anbieter.'] },
        { heading: 'KI-Hilfe', paragraphs: ['KI-Erklärungen, Antworten und persönliche Vorbereitungshinweise werden aus der Stellenanzeige und gegebenenfalls deinem freiwillig übermittelten Hintergrund erzeugt. Sie können unvollständig oder falsch sein und entscheiden nicht über Eignung oder Bewerbungschancen. Prüfe wichtige Angaben immer in der Originalanzeige und beim Arbeitgeber. Teile keine sensiblen persönlichen Daten in KI-Fragen oder deinem lokalen Entwurf.'] },
        { heading: 'Exporte, Kalender und Teilen', paragraphs: ['PDF- und JSON-Exporte sind persönliche Kopien zur eigenen Verwendung. Kalenderübergaben und Share-Grafiken werden nur auf deine Aktion hin erstellt. Prüfe vor dem Teilen, ob Notizen oder Kontodaten für die ausgewählten Empfänger bestimmt sind. Die Share-Grafik gibt Titel, Unternehmen, Ort, Originalquelle und App-Link wieder und ist keine Zusage oder Empfehlung durch einen Arbeitgeber.'] },
        { heading: 'Dein Konto', paragraphs: ['Du bist für den Zugang zu deiner E-Mail-Adresse und deinem Apple-Konto verantwortlich. Du kannst dein Konto jederzeit in den Einstellungen löschen. Wir dürfen Zugänge bei Missbrauch, rechtswidriger Nutzung oder Gefährdung des Dienstes sperren.'] },
        { heading: 'Zulässige Nutzung', paragraphs: ['Nutze die App nicht, um Systeme zu stören, Sicherheitsmaßnahmen zu umgehen, rechtswidrige Inhalte zu übermitteln oder KI-Funktionen zweckwidrig zu manipulieren.'] },
        { heading: 'Externe Dienste', paragraphs: ['Links führen zu Diensten Dritter. Für deren Inhalte, Verfügbarkeit und Datenschutzpraktiken sind die jeweiligen Anbieter verantwortlich.'] },
        { heading: 'Verfügbarkeit und Haftung', paragraphs: ['Wir bemühen uns um einen zuverlässigen Dienst, garantieren aber keine ununterbrochene Verfügbarkeit. Soweit gesetzlich zulässig, haften wir nicht für Entscheidungen, die allein auf Stellenzusammenfassungen oder KI-Antworten beruhen. Gesetzlich zwingende Haftung bleibt unberührt.'] },
        { heading: 'Änderungen und Recht', paragraphs: [`Wir können die App und diese Bedingungen weiterentwickeln. Wesentliche Änderungen werden in der App kenntlich gemacht. Es gilt schottisches Recht, soweit zwingende Verbraucherschutzregeln deines Wohnorts nichts anderes vorsehen. Fragen an ${company.email}.`] },
      ],
    },
    imprint: {
      title: 'Impressum', updated: '15. Juli 2026', externalUrl: 'https://estopia.net/imprint', intro: 'Anbieter und verantwortlich für Apprentice Atlas:',
      sections: [
        { heading: company.name, paragraphs: [company.address, `Company number: ${company.number}`, `VAT number: ${company.vat}`] },
        { heading: 'Kontakt', paragraphs: [`E-Mail: ${company.email}`, `Telefon: ${company.phone}`] },
      ],
    },
    about: {
      title: 'Über Apprentice Atlas', intro: 'Finde deinen nächsten Schritt in der Nähe – klar, ehrlich und ohne Berufsdeutsch.',
      sections: [
        { heading: 'Was die App macht', paragraphs: ['Apprentice Atlas bündelt offizielle Ausbildungs- und Einstiegsstellen für Deutschland und das Vereinigte Königreich auf einer Karte. Du kannst Chancen speichern, Bewerbungen organisieren und Stellenanzeigen verständlich erklären lassen.'] },
        { heading: 'Wichtig', paragraphs: ['Die Originalanzeige bleibt immer die maßgebliche Quelle. Apprentice Atlas ist ein Produkt von Estopia Engineering Ltd.'] },
      ],
    },
  },
  en: {
    privacy: {
      title: 'Privacy policy', updated: '15 July 2026', externalUrl: 'https://estopia.net/privacy',
      intro: 'This policy explains in plain language which data Apprentice Atlas processes and what rights you have.',
      sections: [
        { heading: 'Controller', paragraphs: [`${company.name}, ${company.address}. Contact: ${company.email}, ${company.phone}.`] },
        { heading: 'Data we process', paragraphs: ['You can browse jobs without an account. If you use an account, we process your email address, an internal user ID, any name Apple provides, saved opportunities, application statuses, and optional notes.'], bullets: ['Search country, language, interests, and current situation are stored on your device.', 'Precise location is used for nearby search only after permission. You can always choose a place manually.', 'AI questions are processed to answer them but are not stored in your Apprentice Atlas account.', 'For personal AI preparation, you may provide your background and strengths. This local draft stays on your device; its content is processed transiently for each analysis.'] },
        { heading: 'Purposes and legal bases', paragraphs: ['We process account data and saved content to provide features you request. We use device location only with your consent. You can withdraw location access in iOS at any time and continue with manual search.'] },
        { heading: 'Providers and recipients', paragraphs: ['Supabase provides authentication, database, and server functions. Account data is processed in the EU region. OpenAI processes job content, questions you choose to ask, and background submitted for personal preparation only to produce the requested output; API requests use store: false so storage at OpenAI is disabled. Apple processes data when you use Sign in with Apple. When you open an official listing, that provider’s privacy terms apply.'] },
        { heading: 'Device features and exports', paragraphs: ['Preferences, the local profile draft, and notification identifiers for deadline reminders are device-local and are not synced with your account. When you hand a date to your calendar, Apprentice Atlas opens the native calendar feature with its title and date; your calendar provider then processes that data. Share images are generated locally from the title, company, location, source, and app link and leave the app only through your chosen share destination. PDF export is generated locally from selected account data; full listing descriptions, authentication data, notification identifiers, and the profile draft are excluded. The JSON export remains separately available.'] },
        { heading: 'Retention and deletion', paragraphs: ['Account data, saved opportunities, and application notes remain until you remove them or delete your account. “Settings → Delete account” permanently removes your account and related live data. Backups expire under our providers’ retention schedules. Explanations cached from public job listings do not contain account data.'] },
        { heading: 'Your rights', paragraphs: [`You may request access, correction, erasure, restriction, portability, or object to processing. Contact ${company.email}. You may also complain to the relevant data protection authority.`] },
        { heading: 'Young people', paragraphs: ['The app is designed for students and young adults but does not ask for a date of birth. Do not add sensitive personal information to application notes or AI questions. If local law requires consent from a parent or guardian, please use the app with them.'] },
        { heading: 'Tracking', paragraphs: ['We currently use no advertising, advertising identifiers, or third-party analytics to track you across apps or websites.'] },
      ],
    },
    terms: {
      title: 'Terms of service', updated: '15 July 2026', externalUrl: 'https://estopia.net/terms', intro: 'By using Apprentice Atlas, you agree to these terms.',
      sections: [
        { heading: 'What the app does', paragraphs: ['Apprentice Atlas helps you discover apprenticeships and early-career roles and organise your application journey. It does not provide employment and is not career, legal, or financial advice.'] },
        { heading: 'Listings and applications', paragraphs: ['Listings come from official external sources. The original source controls content, deadlines, availability, and applications. We cannot guarantee every listing is complete, current, or error-free. Applications are made with the external provider.'] },
        { heading: 'AI assistance', paragraphs: ['AI explanations, answers, and personal preparation guidance are generated from the listing and, where provided, your voluntary background. They may be incomplete or wrong and do not determine eligibility or application prospects. Always verify important details in the original listing and with the employer. Do not share sensitive personal data in AI questions or your local draft.'] },
        { heading: 'Exports, calendar, and sharing', paragraphs: ['PDF and JSON exports are personal copies for your own use. Calendar handoffs and share images are created only when you request them. Before sharing, check that any notes or account information are intended for the selected recipients. A share image repeats the title, company, location, original source, and app link; it is not an offer or employer endorsement.'] },
        { heading: 'Your account', paragraphs: ['You are responsible for access to your email address and Apple account. You can delete your account in Settings at any time. We may restrict access for abuse, unlawful use, or threats to the service.'] },
        { heading: 'Acceptable use', paragraphs: ['Do not disrupt systems, bypass security, submit unlawful content, or attempt to misuse or manipulate AI features.'] },
        { heading: 'Third-party services', paragraphs: ['Links open third-party services. Their providers are responsible for their content, availability, and privacy practices.'] },
        { heading: 'Availability and liability', paragraphs: ['We work to keep the service reliable but do not guarantee uninterrupted availability. To the extent permitted by law, we are not liable for decisions based solely on summaries or AI answers. Mandatory legal liability is unaffected.'] },
        { heading: 'Changes and law', paragraphs: [`We may develop the app and these terms. Material changes will be identified in the app. Scots law applies unless mandatory consumer protection law where you live says otherwise. Questions: ${company.email}.`] },
      ],
    },
    imprint: {
      title: 'Legal notice', updated: '15 July 2026', externalUrl: 'https://estopia.net/imprint', intro: 'Provider responsible for Apprentice Atlas:',
      sections: [
        { heading: company.name, paragraphs: [company.address, `Company number: ${company.number}`, `VAT number: ${company.vat}`] },
        { heading: 'Contact', paragraphs: [`Email: ${company.email}`, `Phone: ${company.phone}`] },
      ],
    },
    about: {
      title: 'About Apprentice Atlas', intro: 'Find your next step nearby — clearly, honestly, and without career jargon.',
      sections: [
        { heading: 'What it does', paragraphs: ['Apprentice Atlas brings official apprenticeship and early-career listings from Germany and the United Kingdom onto one map. Save opportunities, organise applications, and get plain-language explanations.'] },
        { heading: 'Good to know', paragraphs: ['The original listing is always the source of truth. Apprentice Atlas is a product of Estopia Engineering Ltd.'] },
      ],
    },
  },
};

export function getLegalDocument(locale: Locale, id: LegalDocumentId): LegalDocument {
  return documents[locale][id];
}

export function isLegalDocumentId(value: string | string[] | undefined): value is LegalDocumentId {
  return typeof value === 'string' && ['privacy', 'terms', 'imprint', 'about'].includes(value);
}
