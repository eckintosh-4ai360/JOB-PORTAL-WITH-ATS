const express = require("express");
const {
    subscribe,
    getMine,
    updateMine,
    decline,
    unsubscribe,
    stats,
    dispatch,
} = require("../controllers/jobAlertController");
const { protect, optionalAuth, adminOnly } = require("../middlewares/authMiddleware");

const router = express.Router();

// Leaving must work straight from a mail client: no login, no token header,
// no front end. The unsubscribe token in the link is the authorisation.
router.get("/unsubscribe", unsubscribe);

// Subscribing works signed in or not — the footer form takes an address from
// a visitor who has no account yet. A signed-in request always uses the
// account's own address (see the controller).
router.post("/subscribe", optionalAuth, subscribe);

router.get("/me", protect, getMine);
router.put("/me", protect, updateMine);
router.post("/decline", protect, decline);

// Sending to the whole subscriber list is a platform-wide action.
router.get("/stats", protect, adminOnly, stats);
router.post("/dispatch", protect, adminOnly, dispatch);

module.exports = router;
