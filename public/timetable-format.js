// Shared by the upload instructions, template builder and server-side reader.
export const TIMETABLE_COLUMNS=[
  ['Tågnummer','trainNumber'],['Station','station'],['Trafikdag','day'],
  ['Ankomst','arrival'],['Avgång','departure'],['Spår','track'],
  ['Från','from'],['Till','to'],['Passerar','noStop'],['Anmärkning','note']
];
export const TABLE_FILE_BYTES=2*1024*1024;
export const TABLE_ROWS=300;
export const TEMPLATE_ROWS=[
  ['P401','Charlottendal','Dagl','09:05','09:10','1a','Lekby','Vagnsta','Nej','Exempelrad – ersätt med din tågrörelse'],
  ['00402','Charlottendal','Lör','','09:12','2b','Vagnsta','Lekby','Ja','Exempelrad – passerar utan uppehåll']
];
