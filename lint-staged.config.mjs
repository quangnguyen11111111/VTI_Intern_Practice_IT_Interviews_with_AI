export default {
  "client/**/*.{js,jsx,ts,tsx}": (filenames) => 
    `cd client && npx eslint --fix ${filenames.join(" ")}`
};
