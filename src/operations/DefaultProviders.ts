import { OperationProvider } from '../Operations';
import { FollowProvider } from './Follow';

export default function getDefaultProviders(): OperationProvider[] {
  return [
    new FollowProvider(),
  ];
}
