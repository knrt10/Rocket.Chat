import { Meteor } from 'meteor/meteor';
import { Match, check } from 'meteor/check';
import moment from 'moment';

import { hasPermission } from '../../../authorization';
import { LivechatSessions } from '../../../models';

Meteor.publish('livechat:location', function(filter = {}) {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', { publish: 'livechat:location' }));
	}

	if (!hasPermission(this.userId, 'view-livechat-manager')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', { publish: 'livechat:location' }));
	}

	check(filter, {
		name: Match.Maybe(String), // Visitor name
		state: Match.Maybe(String), // 'chatting', 'registered', or 'idle', offline
		from: Match.Maybe(String),
		to: Match.Maybe(String),
	});

	let { from, to } = filter;

	if (!(moment(from).isValid() && moment(to).isValid())) {
		return this.error(new Meteor.Error('error-invalid-date', 'Invalid Date', { publish: 'livechat:location' }));
	}
	let query = {};
	from = moment(from).add(1, 'days');
	to = moment(to).add(1, 'days');
	if (moment(from).diff(to) === 0) {
		query.createdAt = {
			$gte: moment(from).utcOffset(0).set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toDate(),
			$lt: moment(to).utcOffset(0).set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).add(1, 'days').toDate(),
		};
	} else {
		query.createdAt = {
			$gte: moment(from).utcOffset(0).set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toDate(),
			$lt: moment(to).utcOffset(0).set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toDate(),
		};
	}
	if (filter.name) {
		query['visitorInfo.name'] = new RegExp(filter.name, 'i');
	}
	if (filter.state) {
		if (filter.state === 'chatting') {
			query.state = 'chatting';
		} else if (filter.state === 'registered') {
			query.state = 'registered';
		} else if (filter.state === 'idle') {
			query.state = 'idle';
		} else {
			query = {};
		}
	}

	const self = this;
	const handle = LivechatSessions.find(query).observeChanges({
		added(id, fields) {
			self.added('livechatLocation', id, fields);
		},
		changed(id, fields) {
			self.changed('livechatLocation', id, fields);
		},
		removed(id) {
			self.removed('livechatLocation', id);
		},
	});

	self.ready();

	self.onStop(function() {
		handle.stop();
	});
});