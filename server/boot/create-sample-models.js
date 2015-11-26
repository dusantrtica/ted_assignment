module.exports = function(app){
	app.dataSources.pgre.automigrate('booking', function(err){
		if(err) throw err;
	});
	app.dataSources.pgre.automigrate('period', function(err){
		if(err) throw err;
	});
	app.dataSources.pgre.automigrate('property', function(err){
		if(err) throw err;
	});

}