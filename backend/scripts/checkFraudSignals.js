/**
 * Behavioural check on the deterministic detectors.
 *
 * Two things matter and they pull against each other: obvious fraud must score
 * high, and an ordinary small Ghanaian employer must NOT. The second is the one
 * that gets shipped wrong, so it is tested first.
 */
const s = require("../utils/fraudSignals");

let failures = 0;
const check = (name, actual, predicate, expectation) => {
    const ok = predicate(actual);
    if (!ok) failures += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      got ${JSON.stringify(actual)} — expected ${expectation}`);
};

console.log("\n─── legitimate small employer (must stay low) ───");
const goodCompany = s.companySignals(
    {
        name: "Adom Health Services",
        description: "Adom Health Services runs three outpatient clinics across Greater Accra. "
            + "We have provided primary care since 2014 and employ forty clinical and admin staff.",
        registrationNumber: "CS-2014-88213",
        website: "https://adomhealth.com.gh",
        hq: "Accra, Ghana",
        contactName: "Efua Mensah",
        contactEmail: "hr@adomhealth.com.gh",
        contactPhone: "+233201234567",
        authorityConfirmedAt: new Date(),
    },
    { email: "hr@adomhealth.com.gh" },
    { jobCount: 2, accountAgeHours: 900 }
);
check("clean company scores low", goodCompany.score, (v) => v < 35, "< 35 (below case threshold)");

// The realistic middle: a genuine micro-business on Gmail with no website.
const gmailCompany = s.companySignals(
    {
        name: "Kwame Tailoring Ltd",
        description: "Family tailoring business in Kumasi since 2009, making school and corporate uniforms "
            + "for local schools and offices. We employ twelve tailors and two apprentices.",
        hq: "Kumasi, Ghana",
        contactName: "Kwame Boateng",
        contactEmail: "kwame.boateng@gmail.com",
        contactPhone: "+233244000111",
        authorityConfirmedAt: new Date(),
    },
    { email: "kwame.boateng@gmail.com" },
    { jobCount: 1, accountAgeHours: 400 }
);
check("gmail micro-business is not auto-actioned", gmailCompany.score, (v) => v < 60,
    "< 60 (informality alone must not reach high)");

console.log("\n─── fake company (must score high) ───");
const fakeCompany = s.companySignals(
    {
        name: "GLOBAL 9988 VENTURES",
        description: "GLOBAL 9988 VENTURES is hiring on SPG Talent Network.",
        contactEmail: "hr@mailinator.com",
    },
    { email: "hr@mailinator.com" },
    { jobCount: 9, accountAgeHours: 3 }
);
check("throwaway-email shell company scores high", fakeCompany.score, (v) => v >= 60, ">= 60");

console.log("\n─── advance-fee scam recruiter (must be critical) ───");
const scam = s.recruiterSignals({ email: "x@y.com" }, [
    {
        title: "URGENT DRIVER NEEDED",
        description: "Salary GHS 15000 monthly. A non-refundable registration fee of GHS 200 is required "
            + "to process your application. Send mobile money then WhatsApp me on 0244000000.",
        salaryMin: 15000,
        createdAt: new Date(),
    },
]);
check("advance-fee scam is critical", scam.score, (v) => v >= 80, ">= 80 (auto-action threshold)");
check("fee signal is present", scam.signals.map((x) => x.id), (v) => v.includes("candidate_fee"),
    "candidate_fee to fire");

console.log("\n─── credential harvesting ───");
const harvest = s.recruiterSignals({}, [{
    title: "Bank Teller",
    description: "To complete onboarding send your bank account number and Ghana card number to our officer.",
    createdAt: new Date(),
}]);
check("credential harvesting is critical", harvest.score, (v) => v >= 80, ">= 80");

console.log("\n─── honest advert must not trip the spam rules ───");
const honest = s.recruiterSignals({}, [{
    title: "Registered Nurse — Care Team",
    description: "Adom Health is recruiting a registered nurse for our Ridge clinic. You will run outpatient "
        + "triage, support the duty doctor, and keep patient records current. Requires a valid NMC Ghana "
        + "licence and two years of ward experience. Apply through this listing.",
    salaryMin: 4500,
    createdAt: new Date(),
}]);
check("honest advert scores zero", honest.score, (v) => v === 0, "0");

console.log("\n─── duplicate detection ───");
const original = {
    id: "job-1",
    companyId: "emp-1",
    title: "Frontend Engineer",
    description: "Build and maintain our React application, working with the design team on new features "
        + "and keeping the component library consistent across the product.",
    requirements: "Three years of React. Strong CSS. Experience with testing.",
};
const exactRepost = { ...original, id: "job-2" };
const scraped = { ...original, id: "job-3", companyId: "emp-99" };

check("exact repost by same employer is flagged",
    s.duplicateJobSignals(exactRepost, [original]).score, (v) => v >= 35, ">= 35 (opens a case)");
check("scraped advert from another employer scores higher",
    s.duplicateJobSignals(scraped, [original]).score,
    (v) => v >= s.duplicateJobSignals(exactRepost, [original]).score, ">= the same-employer score");

const unrelated = {
    id: "job-4",
    companyId: "emp-2",
    title: "Warehouse Supervisor",
    description: "Oversee stock movement, rota the loading team, and report weekly on shrinkage figures "
        + "to the operations manager at our Tema depot.",
    requirements: "Five years in logistics. Forklift certification.",
};
check("unrelated jobs are not duplicates",
    s.duplicateJobSignals(unrelated, [original]).score, (v) => v === 0, "0");

// Reposting your own advert with light edits is normal behaviour, not fraud.
const lightlyEdited = {
    ...original,
    id: "job-5",
    title: "Senior Frontend Engineer",
    description: original.description + " We work in two-week cycles and pair regularly on tricky work.",
};
const editedScore = s.duplicateJobSignals(lightlyEdited, [original]).score;
console.log(`      (lightly edited repost scores ${editedScore})`);

console.log("\n─── fake resume ───");
const year = new Date().getFullYear();
const fakeResume = s.resumeSignals({
    resumeText: ("react react react javascript javascript node node typescript typescript aws ").repeat(30),
    profile: {
        yearsOfExperience: 25,
        seniority: "senior",
        email: "someoneelse@example.com",
        experience: [
            { title: "Dev", company: "A", start: "2021", end: "2024" },
            { title: "Lead", company: "B", start: `${year + 2}`, end: "" },
        ],
    },
    redFlags: ["a", "b", "c"],
}, { duplicateOwnerCount: 2, accountEmail: "real.user@gmail.com" });
check("fabricated resume scores high", fakeResume.score, (v) => v >= 60, ">= 60");

const realResume = s.resumeSignals({
    resumeText: "Experienced registered nurse with eight years in outpatient care across two Accra clinics. "
        + "Led triage for a twelve-bed unit, trained four junior nurses, and maintained patient records "
        + "under NMC Ghana standards. Skilled in wound care, phlebotomy and patient education. "
        + "Seeking a senior care team role where clinical mentoring is part of the work.",
    profile: {
        yearsOfExperience: 8,
        seniority: "senior",
        email: "ama.owusu@gmail.com",
        experience: [
            { title: "Staff Nurse", company: "Ridge Clinic", start: "2016", end: "2021" },
            { title: "Senior Nurse", company: "Adom Health", start: "2021", end: "" },
        ],
    },
    redFlags: [],
}, { duplicateOwnerCount: 0, accountEmail: "ama.owusu@gmail.com" });
// The contract that matters is "opens no case", not "scores exactly zero".
// A terse senior CV is mildly notable and may carry one weak signal; it must
// still land below the case threshold on its own.
check("genuine resume opens no case", realResume.score, (v) => v < 35, "< 35 (no case opened)");

// A full-length CV of the same candidate should be entirely clean.
const fullResume = s.resumeSignals({
    resumeText: [
        "Ama Owusu, Registered Nurse. Eight years of outpatient and triage experience across two clinics",
        "in Greater Accra. Licensed with the Nursing and Midwifery Council of Ghana since 2016.",
        "Senior Nurse, Adom Health Services, 2021 to present. Run the morning triage list for a twelve-bed",
        "outpatient unit, averaging forty patients a day. Supervise three staff nurses and two rotating",
        "students. Rebuilt the paper handover process into a shared digital record, cutting missed",
        "follow-ups by roughly a third over the first year. Support the duty doctor during minor procedures.",
        "Staff Nurse, Ridge Clinic, 2016 to 2021. Delivered wound care, phlebotomy and immunisation across",
        "general outpatients. Trained four junior nurses through their probation. Covered night rota on a",
        "two-week cycle. Sat on the infection control committee from 2019.",
        "Education: Diploma in Nursing, Korle Bu Nursing Training College, 2016.",
        "Skills: triage, wound care, phlebotomy, patient education, record keeping, clinical mentoring,",
        "infection control, immunisation, emergency response, rota planning, stock control.",
        "Referees available on request.",
    ].join(" "),
    profile: {
        yearsOfExperience: 8,
        seniority: "senior",
        email: "ama.owusu@gmail.com",
        experience: [
            { title: "Staff Nurse", company: "Ridge Clinic", start: "2016", end: "2021" },
            { title: "Senior Nurse", company: "Adom Health", start: "2021", end: "" },
        ],
    },
    redFlags: [],
}, { duplicateOwnerCount: 0, accountEmail: "ama.owusu@gmail.com" });
check("full genuine CV scores zero", fullResume.score, (v) => v === 0, "0");

console.log("\n─── score saturation ───");
const many = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, label: "trivial", weight: 12, detail: "" }));
check("many trivial signals cannot reach critical", s.scoreSignals(many), (v) => v < 80, "< 80");
check("one damning signal outranks a pile of trivia",
    s.scoreSignals([{ id: "x", label: "", weight: 90, detail: "" }]),
    (v) => v > s.scoreSignals(many), "> the trivial pile");

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
