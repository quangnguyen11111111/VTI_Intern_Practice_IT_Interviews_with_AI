export default {
  "client/**/*.{js,jsx,ts,tsx}": (filenames) => 
    `npm run lint --prefix client -- --fix ${filenames.join(" ")}`
};
