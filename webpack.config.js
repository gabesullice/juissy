const path = require('path');
const webpack = require('webpack');
const Minify = require('babel-minify-webpack-plugin');

const productionPluginDefine =
  process.env.NODE_ENV === 'production'
    ? [
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify('production'),
        }),
        new Minify(),
      ]
    : [new webpack.SourceMapDevToolPlugin()];

module.exports = [
  {
    entry: './src/index.js',
    output: {
      filename: 'index.js',
      path: path.resolve(__dirname, 'lib'),
    },
    plugins: productionPluginDefine,
    module: {
      loaders: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          exclude: ['/node_modules/'],
          query: {
            plugins: [
              'transform-private-underscore',
              'transform-class-properties',
              'transform-object-rest-spread',
            ],
            presets: [
              [
                '@babel/preset-env',
                {
                  modules: false,
                  targets: {
                    browsers: [
                      'chrome >= 62',
                      'edge >= 15',
                      'fireFox >= 56',
                      'safari >= 11',
                      'opera >= 47',
                    ],
                  },
                },
              ],
            ],
          },
        },
      ],
    },
  },
];
