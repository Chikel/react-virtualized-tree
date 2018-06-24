const webpack = require('webpack');
const path = require('path');

// PLUGINS
const HtmlWebPackPlugin = require('html-webpack-plugin');
const htmlWebpackPlugin = new HtmlWebPackPlugin({
  template: './public/index.html',
  filename: './index.html'
});

const config = {
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"]
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: "awesome-typescript-loader" },
      {
        test: /\.css$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' }
        ]
      }
    ]
  },
  plugins: []
};

module.exports = (env, argv) => {
  if (argv.mode === 'development') {
    config.entry = './src/index.development.tsx';

    config.plugins.push(htmlWebpackPlugin);

    config.devServer = {
      historyApiFallback: true
    };
  }

  if (argv.mode === 'production') {
    config.entry = './src/index.production.tsx';

    config.output = {
      path: path.resolve(__dirname, './dist'),
      filename: 'index.js',
      libraryTarget: 'umd',
      globalObject: 'this',
      library: 'rickle-vt'
    };

    config.externals = {
      'react': {
        commonjs: 'react',
        commonjs2: 'react',
        amd: 'react',
        root: '_'
      },
      'react-dom': {
        commonjs: 'react-dom',
        commonjs2: 'react-dom',
        amd: 'react-dom',
        root: '_'
      }
    };
  }

  return config;
};
