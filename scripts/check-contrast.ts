import { checkBrand } from "./contrast";

const brand = process.env.BRAND ?? "vinchem";
const { errors, report } = checkBrand(`brands/${brand}`);
report.forEach((l) => console.log("  ok  " + l));
errors.forEach((l) => console.error("  FOUT " + l));
if (errors.length) process.exit(1);
console.log(`Contrastcheck ${brand}: alle paren voldoen aan WCAG AA.`);
