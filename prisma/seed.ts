async function main() {
  console.log(
    "No synthetic demo records are seeded. Populate data by scanning authenticated Newton portal sections.",
  );
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
