(function(window, angular, undefined){ 'use strict';
	angular.module('jsonrpc', []).provider('jsonrpc', function() {
		var baseUrl = '/';

		var httpConfig = {};

		var lastRequestId = 0;

		var batch = {};

		var sent = {};

		var processSingleResponse = function(response) {
			if(angular.isUndefined(response.id)) {
				return;
			}
			var request = sent[response.id];
			if(angular.isUndefined(request)) {
				return;
			}

			if(angular.isDefined(response.error)) {
				request.deferred.reject(response.error);
			} else if(angular.isDefined(response.result)) {
				request.deferred.resolve(response.result);
			}

			delete sent[response.id];
		};

		var createCallback = function(fn, request) {
			if(angular.isFunction(fn)) {
				return function(val) {
					var result = fn(val, request);
					return angular.isDefined(result) ? result : val;
				}
			} else {
				return null;
			}
		};

		return {
			setBaseUrl: function(url) {
				baseUrl = url;
				return this;
			},
			getBaseUrl: function() {
				return baseUrl;
			},
			setHttpConfig: function(config) {
				angular.extend(httpConfig, config);
				return this;
			},
			getHttpConfig: function() {
				return httpConfig;
			},
			$get: ['$http', '$timeout', '$q',
				function($http, $timeout, $q) {
					var Method = function(data) {
						angular.extend(this, data);
					};

					Method.prototype.success = function(fn) {
						this.onSuccess = fn;
						return this;
					};

					Method.prototype.error = function(fn) {
						this.onError = fn;
						return this;
					};

					Method.prototype.send = function(params, isNotification) {
						var request = {
							id: isNotification ? undefined : ++lastRequestId,
							method: this.method,
							params: params || this.params,
							url: this.url || baseUrl,
							deferred: $q.defer()
						};

						request.deferred.promise.then(
							createCallback(this.onSuccess, request),
							createCallback(this.onError, request)
						);

						if(angular.isUndefined(batch[request.url])) {
							batch[request.url] = [];
						}
						batch[request.url].push(request);

						$timeout(sendBatch, 0);

						return request.deferred.promise;
					};

					var sendBatch = function() {
						angular.forEach(batch, function(requests, url) {
							var rpcRequests = [];
							angular.forEach(requests, function(request) {
								var rpcRequest = {
									jsonrpc: '2.0',
									id: request.id,
									method: request.method,
									params: request.params || []
								};

								rpcRequests.push(rpcRequest);

								sent[request.id] = request;
							});

							batch[url] = [];

							if(rpcRequests.length > 0) {
								$http.post(url, rpcRequests, httpConfig).success(function(response){
									if(angular.isArray(response)) {
										angular.forEach(response, function(singleResponse){
											processSingleResponse(singleResponse);
										});
									} else {
										processSingleResponse(response);
									}
								});
							}
						});
					};

					return {
						createMethod: function(method, url) {
							return new Method({
								method: method,
								url: url
							});
						}
					};
				}
			]
		}
	});
})(window, window.angular);
