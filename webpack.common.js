const path = require('path');
const fs = require('fs');
const webpack = require('webpack');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const artifact = require('./package.json');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const fileName = `${artifact.name}-${artifact.version.slice(0, 3)}`;

module.exports = (env, argv) => ({
    entry: {
        [fileName]: './src/index.ts',
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    watchOptions: {
        ignored: /node_modules/
    },
    output: {
        filename: '[name].[fullhash].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/',
    },
    devServer: {
        historyApiFallback: true,
        host: '0.0.0.0',
        allowedHosts: 'all',
        compress: true,
        port: 8080,
        server: {
            type: 'https',
            options: {
                key: fs.readFileSync('./server.pem'),
                cert: fs.readFileSync('./server.pem'),
            },
        }
    },
    devtool: 'inline-source-map',
    performance: {
        hints: false,
        maxEntrypointSize: 512000,
        maxAssetSize: 512000,
    },
    module: {
        rules: [
            {
                test: /\.(scss|css)$/,
                use: [
                    { loader: 'style-loader' },
                    { loader: 'css-loader', options: { sourceMap: true, importLoaders: 1 } },
                ],
            },
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.(?:ico|gif|png|jpg|jpeg|webp|svg|stl|glb|ogg)$/i,
                loader: 'file-loader',
                options: {
                    name: '[path][name].[ext]',
                    context: 'src', // prevent display of src/ in filename
                },
            },
            {
                test: /\.(woff(2)?|eot|ttf|otf|)$/,
                loader: 'url-loader',
                options: {
                    limit: 8192,
                    name: '[path][name].[ext]',
                    context: 'src', // prevent display of src/ in filename
                },
            },
        ],
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        // new ESLintPlugin(),
        new CopyWebpackPlugin({
            patterns: [
                { from: './models', to: 'models' },
                { from: './sounds', to: 'sounds' },
                { from: './textures', to: 'textures' },
                { from: './node_modules/three/examples/jsm/libs/draco', to: 'draco' },
            ],
        }),
        new HtmlWebpackPlugin({
            title: 'Three.js Webpack Boilerplate',
            //favicon: path.resolve(__dirname, 'public/favicon.png'),
            template: path.resolve(__dirname, 'src/index.html'), // template file
            filename: 'index.html', // output file
            publicPath: './',
        })
    ],
});