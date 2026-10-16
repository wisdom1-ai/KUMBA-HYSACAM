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