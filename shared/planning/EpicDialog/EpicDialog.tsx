import type { JSX } from 'preact';
import type { EpicModel, Status } from '@doc-platform/models';
import { Dialog } from '@doc-platform/ui';
import { EpicView } from '../EpicView/EpicView';

/** Props for viewing/editing an existing epic */
interface EpicDialogExistingProps {
	epic: EpicModel;
	isNew?: false;
	onClose: () => void;
	onDelete?: (epic: EpicModel) => void;
	onCreate?: never;
}

/** Props for creating a new epic */
interface EpicDialogCreateProps {
	epic?: never;
	isNew: true;
	onClose: () => void;
	onDelete?: never;
	onCreate: (data: { title: string; description?: string; status: Status }) => void;
}

export type EpicDialogProps = EpicDialogExistingProps | EpicDialogCreateProps;

export function EpicDialog(props: EpicDialogProps): JSX.Element {
	const { onClose } = props;

	const title = props.isNew ? 'New Epic' : 'Edit Epic';

	return (
		<Dialog onClose={onClose} title={title}>
			{props.isNew ? (
				<EpicView
					isNew
					onCreate={props.onCreate}
				/>
			) : (
				<EpicView
					epic={props.epic}
					onDelete={props.onDelete}
				/>
			)}
		</Dialog>
	);
}
