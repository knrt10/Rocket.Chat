import { Template } from 'meteor/templating';
import { Mongo } from 'meteor/mongo';
import { ReactiveVar } from 'meteor/reactive-var';
import { FlowRouter } from 'meteor/kadira:flow-router';
import moment from 'moment';

import { LivechatRoom } from '../../collections/LivechatRoom';
import { setDateRange, updateDateRange } from '../../lib/dateHandler';
import { visitorNavigationHistory } from '../../collections/LivechatVisitorNavigation';
import { RocketChatTabBar, popover } from '../../../../ui-utils';
import { t } from '../../../../utils';

import './livechatDashboard.html';

const LivechatLocation = new Mongo.Collection('livechatLocation');

Template.livechatDashboard.helpers({
	visitors() {
		return Template.instance().users.get();
	},
	checkRegister(state) {
		return state === 'registered';
	},
	totalVisitors() {
		return Template.instance().users.get().length;
	},
	flexData() {
		return {
			tabBar: Template.instance().tabBar,
			data: Template.instance().tabBarData.get(),
		};
	},
	daterange() {
		return Template.instance().daterange.get();
	},
	showLeftNavButton() {
		if (Template.instance().daterange.get().value === 'custom') {
			return false;
		}
		return true;
	},
	showRightNavButton() {
		if (Template.instance().daterange.get().value === 'custom' || Template.instance().daterange.get().value === 'today' || Template.instance().daterange.get().value === 'this-week' || Template.instance().daterange.get().value === 'this-month') {
			return false;
		}
		return true;
	},
});

Template.livechatDashboard.events({
	'click .row-link'(e, instance) {
		instance.tabBarData.set(this);
		instance.tabBar.setTemplate('visitorSession');
		instance.tabBar.setData({ label: t('Session_Info'), icon: 'info-circled' });
		instance.tabBar.open();
	},
	'click .lc-date-picker-btn'(e) {
		e.preventDefault();
		const options = [];
		const config = {
			template: 'livechatAnalyticsDaterange',
			currentTarget: e.currentTarget,
			data: {
				options,
				daterange: Template.instance().daterange,
			},
			offsetVertical: e.currentTarget.clientHeight + 10,
		};
		popover.open(config);
	},
	'click .lc-daterange-prev'(e) {
		e.preventDefault();

		Template.instance().daterange.set(updateDateRange(Template.instance().daterange.get(), -1));
	},
	'click .lc-daterange-next'(e) {
		e.preventDefault();

		Template.instance().daterange.set(updateDateRange(Template.instance().daterange.get(), 1));
	},
	'submit form'(event, instance) {
		event.preventDefault();

		const filter = {};
		$(':input', event.currentTarget).each(function() {
			if (this.name) {
				filter[this.name] = $(this).val();
			}
		});

		if (Template.instance().daterange.get()) {
			filter.from = moment(Template.instance().daterange.get().from, 'MMM D YYYY').toISOString();
			filter.to = moment(Template.instance().daterange.get().to, 'MMM D YYYY').toISOString();
		}

		instance.filter.set(filter);
		instance.limit.set(20);
	},
});

Template.livechatDashboard.onRendered(function() {
	this.autorun(() => {
		if (Template.instance().daterange.get()) {
			this.filter.set({
				from: moment(Template.instance().daterange.get().from, 'MMM D YYYY').toISOString(),
				to: moment(Template.instance().daterange.get().to, 'MMM D YYYY').toISOString(),
			});
		}
	});
});

Template.livechatDashboard.onCreated(function() {
	this.ready = new ReactiveVar(false);
	this.limit = new ReactiveVar(20);
	this.filter = new ReactiveVar({});
	this.users = new ReactiveVar([]);
	this.tabBar = new RocketChatTabBar();
	this.tabBarData = new ReactiveVar();
	this.tabBar.showGroup(FlowRouter.current().route.name);

	this.daterange = new ReactiveVar({});
	this.autorun(() => {
		Template.instance().daterange.set(setDateRange());
	});

	this.autorun(() => {
		this.ready.set(this.subscribe('livechat:rooms', {}, 0, this.limit.get()).ready());
	});

	if (Template.instance().daterange.get()) {
		this.filter.set({
			from: moment(Template.instance().daterange.get().from, 'MMM D YYYY').toISOString(),
			to: moment(Template.instance().daterange.get().to, 'MMM D YYYY').toISOString(),
		});
	}

	this.autorun(() => {
		const sub = this.subscribe('livechat:location', this.filter.get());
		if (sub.ready()) {
			const users = LivechatLocation.find({}).map((data) => data);
			if (users && users.length > 0) {
				users.map((val) => {
					// eslint-disable-next-line new-cap
					const currentTime = new moment();
					const duration = moment.duration(currentTime.diff(val.createdAt));
					const hours = duration.get('hours');
					const days = duration.get('d');
					if (days >= 1) {
						val.timeSince = `${ days }d`;
					} else {
						val.timeSince = `${ hours }h:${ duration.get('minutes') }m:${ duration.get('seconds') }s`;
					}
					this.subscribe('livechat:visitorPageVisited', { rid: '', token: val.token });
					const pageInfo = visitorNavigationHistory.find({ token: val.token }, { sort: { ts: -1 } }).map((data) => data);
					if (pageInfo) {
						val.pageInfo = pageInfo;
					}

					const room = LivechatRoom.findOne({ t: 'l', 'v.token': val.token });
					if (room && room.servedBy) {
						val.servedBy = room.servedBy;
					}
					if (['Macintosh', 'iPhone', 'iPad'].indexOf(val.deviceInfo.os) !== -1) {
						val.osIcon = 'icon-apple';
					} else {
						val.osIcon = `icon-${ val.deviceInfo.os.toLowerCase() }`;
					}
					val.browserIcon = `icon-${ val.deviceInfo.browserName.toLowerCase() }`;

					return val;
				});
			}
			this.users.set(users);
		}
	});
});