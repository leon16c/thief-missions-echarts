const path = require('path');
const { SourceMapDevToolPlugin } = require('webpack');

// Uncomment the externals block below if you want to rely on host-provided copies
// of echarts/lodash instead of bundling them. Leaving it commented means the
// bundle ships its own copies.
// const externals = {
//     echarts: 'echarts',
//     lodash: '_',
// };

module.exports = {
    entry: './src/index.ts',
    devtool: 'inline-source-map',
    // externals,
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
        new SourceMapDevToolPlugin({
          filename: '[file].map',
        }),
      ],
};
