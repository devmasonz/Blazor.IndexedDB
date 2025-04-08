const path = require('path');
const webpack = require('webpack');

module.exports = (env, args) =>({
    resolve: {
        extensions: ['.ts', '.js']
    },
    devtool: false,
    module: {
        rules: [
            {
                test: /\.ts?$/,
                loader: 'ts-loader'
            }
        ]
    },
    entry: {
        "indexedDb.Blazor": './client/InitialiseIndexDbBlazor.ts'
    },
    output: {
        path: path.join(__dirname, '/wwwroot'),
        filename: '[name].js'
    }
});
