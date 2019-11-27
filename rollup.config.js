import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';
import pkg from './package.json';
import rollupExternalModules from 'rollup-external-modules';

const input = './lib/index.js';

export default [
  {
    input,
    output: {
      file: pkg.main,
      format: 'cjs'
    },
    external: rollupExternalModules,
    plugins: [
      babel({
        runtimeHelpers: true,
        plugins: ['@babel/transform-runtime']
      }),
      nodeResolve(),
      commonjs()
    ]
  },

  {
    input,
    output: {
      file: pkg.module,
      format: 'esm'
    },
    external: rollupExternalModules,
    plugins: [
      babel({
        runtimeHelpers: true,
        plugins: [['@babel/transform-runtime', { useESModules: true }]]
      }),
      nodeResolve(),
      commonjs()
    ]
  }
];
