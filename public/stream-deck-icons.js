// Icons a Stream Deck key may carry (operating, page and navigation keys only; a
// route or a train always shows its state). SVG path data on a 24 × 24 grid, drawn
// with a stroke both on the deck (canvas Path2D) and in the editor (inline SVG).
export const ICONS={
  reset:{name:'Återställ',d:'M3 12a9 9 0 1 0 3-6.7M3 4v5h5'},
  stop:{name:'Stopp',d:'M8 3h8l5 5v8l-5 5H8l-5-5V8z'},
  cancel:{name:'Avbryt',d:'M6 6l12 12M18 6L6 18'},
  next:{name:'Nästa',d:'M5 12h14M13 6l6 6-6 6'},
  prev:{name:'Föregående',d:'M19 12H5M11 6l-6 6 6 6'},
  home:{name:'Hem',d:'M3 11l9-8 9 8M5 10v10h14V10'},
  yard:{name:'Rangerbangård',d:'M3 7h18M3 12h18M3 17h18M7 7l5 10'},
  train:{name:'Tåg',d:'M6 3h12v12H6zM6 11h12M8 19l-2 2M16 19l2 2'},
  phone:{name:'Telefon',d:'M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2'},
  alert:{name:'Larm',d:'M12 3l10 18H2zM12 10v5M12 18v.5'},
  lock:{name:'Lås',d:'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4'},
  clock:{name:'Klocka',d:'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 2'}
};
export const ICON_IDS=Object.keys(ICONS);
