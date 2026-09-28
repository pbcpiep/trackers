// Public (browser-safe) settings for cloud sync. The publishable/anon key is
// meant to be public; row-level security in Supabase protects the data.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || null,
  });
};
