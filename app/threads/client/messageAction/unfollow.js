import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';

import { Messages } from '../../../models/client';
import { settings } from '../../../settings/client';
import { MessageAction, call } from '../../../ui-utils/client';
import { messageArgs } from '../../../ui-utils/client/lib/messageArgs';

Meteor.startup(function() {
	Tracker.autorun(() => {
		if (!settings.get('Threads_enabled')) {
			return MessageAction.removeButton('unfollow-message');
		}
		MessageAction.addButton({
			id: 'unfollow-message',
			icon: 'bell-off',
			label: 'Unfollow_message',
			context: ['threads'],
			async action() {
				const { msg } = messageArgs(this);
				call('unfollowMessage', { mid: msg._id });
			},
			condition({ tmid, replies = [] }) {
				if (tmid) {
					const parentMessage = Messages.findOne({ _id: tmid }, { fields: { replies: 1 } });
					if (parentMessage) {
						replies = parentMessage.replies || [];
					}
				}
				return replies.includes(Meteor.userId());
			},
			order: 0,
			group: 'menu',
		});
	});
});
