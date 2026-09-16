/**
 * Ensures returned objects have `_id: item.id` to preserve 100% backward
 * compatibility with frontend components expecting MongoDB _id property.
 */
function toClient(item) {
    if (!item) return item;
    if (Array.isArray(item)) {
        return item.map(toClient);
    }
    if (typeof item !== "object" || item instanceof Date) {
        return item;
    }

    const copy = { ...item };
    if (copy.id && !copy._id) {
        copy._id = copy.id;
    }

    // Recurse into nested objects/relations
    for (const key of Object.keys(copy)) {
        if (copy[key] && typeof copy[key] === "object" && !(copy[key] instanceof Date)) {
            copy[key] = toClient(copy[key]);
        }
    }

    return copy;
}

module.exports = { toClient };
