var path = require("path")

const webpack = require("webpack")

module.exports = {
  // Change to your "entry-point".
  entry: "./lib/coinray",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "app.bundle.js"
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"]
  },
  module: {
    rules: [{
      // Include ts, tsx, js, and jsx files.
      test: /\.(ts|js)x?$/,
      exclude: /node_modules/,
      loader: "babel-loader",
    }],
  },
  plugins: [
    new webpack.DefinePlugin({
      "VERSION": JSON.stringify(require("./package.json").version),
    }),
  ],
  target: "node"
}
