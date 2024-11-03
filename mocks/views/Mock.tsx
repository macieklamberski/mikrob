// This "mock" file is necessary in order to be able to mock the view in one of tests for the
// createPage(). Using mock.module is currently non-reversible action, so there's no way to
// undo the mock in the following tests. Because of that, no valid view should be used for mocking
// as it may be used in other tests. When the issue is resolved in Bun, this can be removed.
// Link to the issue: https://github.com/oven-sh/bun/issues/7823.
export default () => 'Test'
