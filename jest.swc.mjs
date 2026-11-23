/** Shared SWC transform for Jest (decorator metadata is required by Nest DI). */
export const swcTransform = {
  '^.+\\.(t|j)s$': [
    '@swc/jest',
    {
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2023',
        keepClassNames: true,
      },
      module: { type: 'commonjs' },
      sourceMaps: 'inline',
    },
  ],
};
