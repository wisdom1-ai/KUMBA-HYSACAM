const STORAGE_KEY = "hysacam_kumba_bins";

const samplebins = [
  {
    id: 1,
     name: "KUMBA TOWN BIN 1",
    area: "KUMBA TOWN",
    status: "available",
    lat: 4.635,
    lng: 9.448,
    lastUpdate: new Date().toISOSTring()
  },
  {
    id: 2,
    name: "FIANGO Bin 1", 
    area:" FAINGO",
    status: "available",
    lat: 4.640,
    lng: 9.452,
    lastupdate: new date().toISOString()
    }
  ];

function getDustbins() {
try {
  const saved = localstorage.getitems(STORAGE_KEY);
  return SAVED ? JSON.parse(saved) : sampleBins;
    } catch (error) {
  console.error("could not load dustbins:", error);
return sampleBins;
 }
}
function saveDustbins(bins) {
  localstorage.setItem(STORAGE_KEY, JSON.stringify(bins));
}
function addDustbin(bin) {
  const bins = geDustbins() {
   
    const newBins = {
      ...bin,
      id: Date.now(),
        lastupdate:new Date().toISOString()
  };
  bins.push(newBin);
  saveDusttbins(bins);
  return newBin;
}

function updateDustbin(id,updates) {
  const bins = getDustbinS().map(bin) =>
  bin.id === id
  ? { ...bin, ...updates, lastupdated: new Date().toISOString() }
    : bin
  );
  
  saveDustbins(bins);
  return bins.find(bin) => bin.id ===id);
}

function deletDustBin(id) {
  const bins = getDustBins().filter((bin) =>bin.id !== id);
  saveDusrbins(bins)
}
function getDustBidBystatus(status) {
  return getDustBins().filter((bin) => bin.status === status)
  }
function deleteDustById(id) {
  retun getDustbins().find((bin) =>.id === id);
}                                                    S
