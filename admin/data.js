/**
data
└── teams (Array)
    └── 0 (Object)
        ├── players (Array)
        │   └── 0 (Object)
        │       ├── name
        │       └── inGameId
        ├── games (Array)
        │   └── 0 (Object)
        │       ├── placeTaken
        │       ├── killsMade
        │       ├── penaltyPoints
        │       └── playersSurvived
        └── bucksBank: 0
 */
const data = {
  teams: [
    {
      players: [{ name: "alpha", inGameId: "XXXXXXX" }],
      games: [
        {
          placeTaken: 1,
          killsMade: 0,
          penaltyPoints: 0,
          playersSurvived: 0,
        },
      ],
      bucksBank: 0,
    },
  ],
};

/*
* │ – Pionowa
* ─ – Pozioma

* ┼ – Pełne skrzyżowanie (cztery kierunki)
* ├ – Rozdroże w prawo (lewa krawędź + odgałęzienie)
* ┤ – Rozdroże w lewo (prawa krawędź + odgałęzienie)
* ┬ – Rozdroże w dół (górna krawędź + odgałęzienie)
* ┴ – Rozdroże w górę (dolna krawędź + odgałęzienie)

* ┌ – Lewy górny
* ┐ – Prawy górny
* └ – Lewy dolny
* ┘ – Prawy dolny

* ├─ – Element środkowy (ma dalszych sąsiadów na tym samym poziomie)
* └─ – Element końcowy (ostatni na danym poziomie)
* │ – Przedłużenie linii pionowej dla głębszych poziomów
* – Wcięcie (pusta przestrzeń) dla głębszych poziomów

## 2. Złożone drzewo (Zagnieżdżone obiekty i tablice)

┌── data
├── id: "req-9872"
├── status: 200
├── info
│   ├── createdAt: "2026-07-20"
│   └── origin: "API_MAIN"
└── payload
    ├── count: 2
    └── items
        ├─ 0
        │  ├── title: "Produkt A"
        │  └── price: 49.99
        └── 1
           ├── title: "Produkt B"
           └── price: 12.50

## 3. Struktura komponentu / DOM (Format drzewiasty)

┌── App
├── Header
│   ├── Logo
│   └── Navigation
├── MainContent
│   ├── Sidebar
│   │   ├── Menu
│   │   └── Filter
│   └── ArticleList
│       ├── ArticleItem
│       └── Pagination
└── Footer

*/
