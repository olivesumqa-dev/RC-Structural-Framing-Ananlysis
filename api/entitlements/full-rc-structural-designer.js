const { requireUser } = require("../_lib/supabase");
const { entitlementFor } = require("../_lib/entitlements");
module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  try { const user = await requireUser(req); return res.status(200).json(await entitlementFor(user.id)); }
  catch (error) { return res.status(error.statusCode || 500).json({ error: error.message }); }
};
