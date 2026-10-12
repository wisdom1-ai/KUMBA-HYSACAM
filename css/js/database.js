/* HYSACAM Kumba Tracker — local collection-point database.
   Keeps the existing storage key so existing records are not discarded. */
const STORAGE_KEY = "hysacam_kumba_bins";
const CHANGE_EVENT = "hysacam:dustbins-changed";

const sampleBins = [
  { id: 1, name: "Kumba Town Bin 1", area: "Kumba Town", status: "available", latitude: 4.635, longitude: 9.448, address: "Sample location — verify in the field", lastUpdated: new Date().toISOString(), isSample: true },
  { id: 2, name: "Fiango Bin 1", area: "Fiango", status: "available", latitude: 4.640, longitude: 9.452, address: "Sample location — verify in the field", lastUpdated: new Date().toISOString(), isSample: true }
];

function announceChange() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}
function cloneSamples() { return sampleBins.map(bin => ({ ...bin })); }
function getDustbins() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return cloneSamples();
    const bins = JSON.parse(saved);
    return Array.isArray(bins) ? bins.filter(bin => bin && typeof bin === "object") : cloneSamples();
  } catch (error) {
    console.error("Could not load dustbins:", error);
    return cloneSamples();
  }
}
function saveDustbins(bins) {
  if (!Array.isArray(bins)) throw new Error("Dustbins must be provided as an array.");
  // Validate the payload before touching the existing saved data.
  const serialized = JSON.stringify(bins);
  localStorage.setItem(STORAGE_KEY, serialized);
  announceChange();
}
function normalizeBin(input, existing = {}) {
  const name = String(input.name ?? existing.name ?? "").trim();
  const area = String(input.area ?? existing.area ?? "").trim();
  const latitude = Number(input.latitude ?? existing.latitude);
  const longitude = Number(input.longitude ?? existing.longitude);
  const status = String(input.status ?? existing.status ?? "unknown").toLowerCase();
  const address = String(input.address ?? existing.address ?? "").trim();
  if (!name || !area) throw new Error("Enter a collection point name and area.");
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Enter valid latitude and longitude values.");
  }
  if (!["available", "full", "damaged", "unknown"].includes(status)) throw new Error("Choose a valid collection status.");
  return { ...existing, ...input, name, area, status, latitude, longitude, address, lastUpdated: new Date().toISOString(), isSample: false };
}
function addDustbin(bin) {
  const bins = getDustbins();
  const newBin = normalizeBin(bin, { id: bin.id ?? Date.now() });
  if (bins.some(item => String(item.id) === String(newBin.id))) newBin.id = Date.now() + Math.floor(Math.random() * 1000);
  bins.push(newBin);
  saveDustbins(bins);
  return newBin;
}
function updateDustbin(id, updates) {
  const bins = getDustbins();
  const index = bins.findIndex(bin => String(bin.id) === String(id));
  if (index < 0) return null;
  bins[index] = normalizeBin(updates, bins[index]);
  saveDustbins(bins);
  return bins[index];
}
function deleteDustbin(id) {
  const bins = getDustbins();
  const updated = bins.filter(bin => String(bin.id) !== String(id));
  if (updated.length === bins.length) return false;
  saveDustbins(updated);
  return true;
}
function getDustbinById(id) { return getDustbins().find(bin => String(bin.id) === String(id)) ?? null; }
function getDustbinsByStatus(status) { return getDustbins().filter(bin => String(bin.status).toLowerCase() === String(status).toLowerCase()); }
function resetDustbins() { localStorage.removeItem(STORAGE_KEY); announceChange(); }

// Shared API for the classic interface script and the ES-module map.
window.HysacamDB = { STORAGE_KEY, getDustbins, saveDustbins, addDustbin, updateDustbin, deleteDustbin, getDustbinById, getDustbinsByStatus, resetDustbins };

