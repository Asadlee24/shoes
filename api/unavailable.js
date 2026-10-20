export default function unavailable(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(503).json({
    error:
      "Online requests and store management are being set up. Please contact QADAM FLEX on WhatsApp at 03237205097.",
  });
}
