import { resetDemo } from "../src/lib/demo";
resetDemo()
  .then(({ archived, to }) =>
    console.log(
      archived
        ? `Archived ${archived} session folders to ${to}`
        : "Nothing to reset: data/ is already empty",
    ),
  )
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
