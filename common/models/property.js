'use strict';

var app = require('../../server/server');

module.exports = function(Property) {
	/* !!! Please read !!!:

	In order to get all of the properties that are available in between start date and end date, we query
	the database and find ones that match our criteria. Criteria is the following:
	Property is available in startDate-endDate timeframe IF:

	1. 	Exists at least one Period that has type set to 'available' and with startDate and endDate such is
		Period.startDate <= startDate && endDate <= Period.endDate 
	AND
	2.	There exists NO Booking for a given Property such is:
		Booking.startDate IN BETWEEN [startDate, endDate] NOR Booking.endDate IN BETWEEN [startDate, endDate].
		In other words, if there is a Booking for a given Property that either Booking.startDate IN BETWEEN [startDate,endDate] OR
		Booking.endDate IN BETWEEN [startDate, endDate], that Property is not considered as available.

	
	There are 2 solutions and whose efficiency depend on the database that we are using. For instance, MongoDB and other NoSQL databases,
	has nesting data capabilites, that is, bookings and periods can be the part of Property document, but also can be referenced to trough
	foreign keys. This is worth mentioning because, if we were using Mongo, for instance, we can create a query that iterates trough subdocuments
	and subcollections to match our criteria. Since we do not use MongoDB, we can not use its querying capabilites, so the first approach is to fetch 
	all the Properties and to iterate trough them and trough their Bookings and Periods to find a match. This is getAllByDateV1.

	Other solution is to rely on the fact that we were using relational database. So, first, I will get all the Periods and it's Property (Property is the
	part of a Period) that are available then to intersect these with all of the Bookings (from the separate table) to get all avaialble Bookings.
	The result will be Properties that have Booking and Period available in desired timeframe. This is getAllByDateV2.
	*/

	Property.getAllByDateV1 = function(startDate, endDate, cb){
		var Period = app.models.period;
		var Booking = app.models.booking;
		
		Property.find({}, function(err, properties){
			var availableProperties = [];
			properties.forEach(function(property, index){
				var availablePeriods = property.periods.filter(function(period){
					return (period.start_date <= startdate && endDate <= period.end_date && period.type === 'available');
				});

				var bookingsInTheGivenTimeframe = property.bookings.filter(function(booking){
					return ((startDate <= booking.start <= endDate ) ||
							(startDate <= booking.end <= endDate));
				});

				if(!!availablePeriods && bookingsInTheGivenTimeframe.length === 0){
					availableProperties.push(property);
				}
			});
			cb(null, availableProperties);
		});		
	},

	Property.getAllByDateV2 = function(startDate, endDate,cb){
		var Period = app.models.period;
		var Booking = app.models.booking;
		// First, first get all available Periods, and for each of them, try to get Booking with the same
		// PropertyID that is available. This is basically JOIN operation accorss Booking, Period, and Property table over
		// propertyId where the criteia is that Period is available and there is no Booking for that period.
		var availableProperties = [];
		Period.find({where: 
						{and: 
							[{start_date: {between:[startDate, endDate]}}, 
							{end_date: {between:[startDate, endDate]}}, 
							{type: 'available'}]}}, 
				function (err, availablePeriods){
					// Extract property ids from availablePeriods
					var propertyIds = availablePeriods.map(function(period){return period.propertyId});
					Booking.find({where:
						{and:[
							{start: {between:[startDate, endDate]}},
							{end: {between:[startDate, endDate]}},
							{propertyId: {inq:propertyIds}}
						]}
					}, function (err, bookingsInTheGivenTimeframe){
						// Now we have Bookings that are placed in the desired timeframe.
						// We want to remove these (Booking.propertyId) from propertyId (the list of all Properties
						// what are available. The result is Properties that do have available Period and for which
						// does not exist Bookin within the given time
						//var availablePropertiesIds = [];
						var availablePropertiesIds = bookingsInTheGivenTimeframe.filter(function(booking){
								return (propertyIds.indexOf(booking.propetyId) > -1);
							}).map(function(item){return item.propertyId});

						Property.find({where: {id: {inq:availablePropertiesIds}}}, function(err, properties){
							cb(null, properties);
						});		
					});
				});
	}

	Property.remoteMethod(
		'getAllByDateV1',
		{
			accepts: [{arg: 'startdate', type: 'date'}, {arg: 'enddate',type: 'date'}],
			returns: {arg: 'properties', type: 'object'}
		}
	);

	Property.remoteMethod(
		'getAllByDateV2',
		{
			accepts: [{arg: 'startdate', type: 'date'}, {arg: 'enddate',type: 'date'}],
			returns: {arg: 'properties', type: 'object'}
		}
	);

};
