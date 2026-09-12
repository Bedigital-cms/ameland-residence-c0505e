/**
 * Interface strings the TEMPLATE itself needs, per language.
 *
 * These are not editorial content — they are accessibility labels and interface words that markup
 * requires but no content field supplies (a breadcrumb nav needs an accessible name; a landmark needs
 * a label). Editorial copy stays in `content/<locale>/*.json` and is never duplicated here.
 *
 * Kept deliberately tiny. Anything a visitor reads as page CONTENT belongs in the CMS, not in code —
 * if a string here starts growing into a sentence, it is content and should move.
 *
 * Falls back to the default locale's string, then to the key's Dutch value, so a newly activated
 * language never renders an empty label.
 */
const UI = {
  nl: {
    breadcrumb: 'Kruimelpad',
    skipToContent: 'Naar de inhoud',
    readMore: 'Lees meer',
    readLess: 'Lees minder',
    goodToKnow: 'Goed om te weten',
    checkAvailability: 'Bekijk beschikbaarheid',
    ourVillas: "Onze villa's",
    moreInfo: 'Meer informatie',
    // Blog overview
    featured: 'Uitgelicht',
    searchArticles: 'Zoek in artikelen',
    searchPlaceholder: 'Waar bent u naar op zoek?',
    search: 'Zoeken',
    allTopics: 'Alle onderwerpen',
    resultOne: '1 artikel',
    resultMany: '{n} artikelen',
    forQuery: 'voor “{q}”',
    reset: 'Filters wissen',
    noResults: 'Geen artikelen gevonden. Probeer een andere zoekterm of kies een ander onderwerp.',
    pagination: 'Paginering',
    goToPage: 'Ga naar pagina {n}',
    // Villa overview filters
    filterVillas: 'Filter',
    filterAll: "Alle villa's",
    filterPets: 'Hond welkom',
    filterLocation: 'Plaats',
    filterGuests: 'Personen',
    filterBedrooms: 'Slaapkamers',
    villaCountAll: "{n} villa's",
    villaCountFiltered: "{n} van {total} villa's",
    noVillas: "Geen villa's gevonden met deze combinatie.",
    // Villa overview — guest composition
    partyTitle: 'Reisgezelschap',
    partyAdults: 'Volwassenen',
    partyAdultsAge: 'vanaf 18 jaar',
    partyChildren: 'Kinderen',
    partyChildrenAge: '2 t/m 18 jaar',
    partyBabies: 'Baby’s',
    partyBabiesAge: 'tot 2 jaar, tellen niet mee',
    partyIncrease: '{field} toevoegen',
    partyDecrease: '{field} verwijderen',
    partyMaxReached: 'Maximaal {n} personen (baby’s niet meegerekend).',
    // Kaartfeiten: "8 personen", "4 slaapkamers" — het getal staat ervoor.
    guestsUnit: 'personen',
    bedroomsUnit: 'slaapkamers',
    allArticles: 'Alle {n} artikelen',
    // Villa detail — key facts
    keyFacts: 'Kenmerken',
    guests: 'Personen',
    bedrooms: 'Slaapkamers',
    bathrooms: 'Badkamers',
    sauna: 'Sauna',
    pets: 'Huisdieren',
    evCharging: 'Laadpaal',
    location: 'Ligging',
    yes: 'Ja',
    no: 'Nee',
    // Villa detail — anchor navigation
    navOnThisPage: 'Op deze pagina',
    navAbout: 'Over deze villa',
    navPhotos: "Foto's",
    navLayout: 'Indeling',
    navFeatures: 'Voorzieningen',
    navFaq: 'Veelgestelde vragen',
    navBooking: 'Boeken',
    petsAllowed: 'Hond welkom',
    // Gallery / lightbox
    photos: "Foto's",
    photo: 'foto',
    close: 'Sluiten',
    previous: 'Vorige',
    next: 'Volgende',
    playVideo: 'Video afspelen: {title}',
    // Related articles on a villa page
    relatedArticles: 'Lees meer over Ameland',
    readArticle: 'Lees het artikel',
  },
  de: {
    breadcrumb: 'Brotkrümelnavigation',
    skipToContent: 'Zum Inhalt springen',
    readMore: 'Mehr lesen',
    readLess: 'Weniger lesen',
    goodToKnow: 'Gut zu wissen',
    checkAvailability: 'Verfügbarkeit ansehen',
    ourVillas: 'Unsere Ferienhäuser',
    moreInfo: 'Mehr Informationen',
    // Blog overview
    featured: 'Empfohlen',
    searchArticles: 'In Artikeln suchen',
    searchPlaceholder: 'Wonach suchen Sie?',
    search: 'Suchen',
    allTopics: 'Alle Themen',
    resultOne: '1 Artikel',
    resultMany: '{n} Artikel',
    forQuery: 'für „{q}“',
    reset: 'Filter zurücksetzen',
    noResults: 'Keine Artikel gefunden. Versuchen Sie einen anderen Suchbegriff oder ein anderes Thema.',
    pagination: 'Seitennummerierung',
    goToPage: 'Zu Seite {n}',
    // Villa overview filters
    filterVillas: 'Filter',
    filterAll: 'Alle Ferienhäuser',
    filterPets: 'Hund willkommen',
    filterLocation: 'Ort',
    filterGuests: 'Personen',
    filterBedrooms: 'Schlafzimmer',
    villaCountAll: '{n} Ferienhäuser',
    villaCountFiltered: '{n} von {total} Ferienhäusern',
    noVillas: 'Keine Ferienhäuser mit dieser Kombination gefunden.',
    // Villa overview — guest composition
    partyTitle: 'Reisegruppe',
    partyAdults: 'Erwachsene',
    partyAdultsAge: 'ab 18 Jahren',
    partyChildren: 'Kinder',
    partyChildrenAge: '2 bis 18 Jahre',
    partyBabies: 'Babys',
    partyBabiesAge: 'unter 2 Jahren, zählen nicht mit',
    partyIncrease: '{field} hinzufügen',
    partyDecrease: '{field} entfernen',
    partyMaxReached: 'Maximal {n} Personen (Babys nicht mitgerechnet).',
    // Kartenfakten: "8 Personen", "4 Schlafzimmer" — die Zahl steht davor.
    guestsUnit: 'Personen',
    bedroomsUnit: 'Schlafzimmer',
    allArticles: 'Alle {n} Artikel',
    // Villa detail — key facts
    keyFacts: 'Merkmale',
    guests: 'Personen',
    bedrooms: 'Schlafzimmer',
    bathrooms: 'Badezimmer',
    sauna: 'Sauna',
    pets: 'Haustiere',
    evCharging: 'Ladestation',
    location: 'Lage',
    yes: 'Ja',
    no: 'Nein',
    // Villa detail — anchor navigation
    navOnThisPage: 'Auf dieser Seite',
    navAbout: 'Über dieses Ferienhaus',
    navPhotos: 'Fotos',
    navLayout: 'Grundriss',
    navFeatures: 'Ausstattung',
    navFaq: 'Häufige Fragen',
    navBooking: 'Buchen',
    petsAllowed: 'Hund willkommen',
    // Gallery / lightbox
    photos: 'Fotos',
    photo: 'Foto',
    close: 'Schließen',
    previous: 'Zurück',
    next: 'Weiter',
    playVideo: 'Video abspielen: {title}',
    // Related articles on a villa page
    relatedArticles: 'Mehr über Ameland lesen',
    readArticle: 'Artikel lesen',
  },
} as const

export type UiKey = keyof (typeof UI)['nl']

/** An interface string for a locale, falling back to Dutch when the language has no entry yet. */
export function t(locale: string, key: UiKey): string {
  const table = (UI as Record<string, Partial<Record<UiKey, string>>>)[locale]
  return table?.[key] ?? UI.nl[key]
}
