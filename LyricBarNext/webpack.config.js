// 基于 solstice23/lyric-bar-netease 的 webpack 配置精简而来

const path = require("path");
const webpack = require("webpack");
const copyWebpackPlugin = require("copy-webpack-plugin");
const TerserPlugin = require('terser-webpack-plugin');

const config = {
  entry: "./src/main.js",
  output: {
    path: path.resolve(__dirname, "dist"),
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: 'LyricBarNext —— 网易云音乐 3.x 软件内词栏插件 | Copyright (C) 2026 Plana | 以 GPL-3.0-or-later 授权（完整文本与来源见项目 LICENSE 与 README）',
      entryOnly: true,
    }),
    new copyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "src", "manifest.json"),
          to: path.resolve(__dirname, "dist", "manifest.json"),
        },
        {
          from: path.resolve(__dirname, "src", "preview.png"),
          to: path.resolve(__dirname, "dist", "preview.png"),
        }
      ]
    }),
  ],
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/i,
        loader: "babel-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.s[ac]ss$/i,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
        type: "asset",
      },
    ],
  },

  optimization: {
    minimizer: [new TerserPlugin({
      terserOptions: {
        format: {
          // 仅保留 GPL 许可 banner（BannerPlugin 注入），其余注释照常剥离
          comments: /GPL-3\.0-or-later/,
        },
      },
      extractComments: false,
    })],
  },
};

module.exports = () => {
  config.mode = process.env.NODE_ENV == "production" ? "production" : "development";
  return config;
};
