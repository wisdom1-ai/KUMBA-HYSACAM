const SUPABASE_URL = "https://edylcpvigtmyuehjeibe.supabase.co";
const SUPABASE_KEY = "sb_publishable_M2JBYBmf8mLJbUS88et3Ww_K3spt6Bh";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
supabaseClient
  .from("bins")
  .select("id")
  .limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error("Supabase test failed:", error.message);
    } else {
      console.log("Supabase connected successfully!");
    }
  });
  async function testSupabaseBins() {
  const { data, error } = await supabaseClient
    .from("bins")
    .select("id, name, area, latitude, longitude, status")
    .limit(5);

  if (error) {
    console.error("Could not read bins:", error.message);
    return;
  }

  console.log("Supabase bins loaded:", data);
}

testSupabaseBins();