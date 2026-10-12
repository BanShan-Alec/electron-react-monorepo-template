import { memo } from 'react';
import { UpdaterFeature } from '@/features/updater';

const _App = () => {
  return <UpdaterFeature />;
};

const App = memo(_App);

export { App };
export default App;
