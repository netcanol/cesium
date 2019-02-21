defineSuite([
        'Scene/DiscardMissingTileImagePolicy',
        'Core/Cartesian2',
        'Core/FeatureDetection',
        'Core/Resource',
        'Specs/pollToPromise',
        'ThirdParty/when'
    ], function(
        DiscardMissingTileImagePolicy,
        Cartesian2,
        FeatureDetection,
        Resource,
        pollToPromise,
        when) {
    'use strict';

    beforeAll(function() {
        // This suite spies on requests. The test below needs to make a request to a data URI.
        // We run it here to avoid interfering with the tests.
        return Resource.supportsImageBitmapOptions();
    });

    afterEach(function() {
        Resource._Implementations.createImage = Resource._DefaultImplementations.createImage;
        Resource._Implementations.loadWithXhr = Resource._DefaultImplementations.loadWithXhr;
    });

    describe('construction', function() {
        it('throws if missingImageUrl is not provided', function() {
            function constructWithoutMissingImageUrl() {
                return new DiscardMissingTileImagePolicy({
                    pixelsToCheck : [new Cartesian2(0, 0)]
                });
            }
            expect(constructWithoutMissingImageUrl).toThrowDeveloperError();
        });

        it('throws if pixelsToCheck is not provided', function() {
            function constructWithoutPixelsToCheck() {
                return new DiscardMissingTileImagePolicy({
                    missingImageUrl : 'http://some.host.invalid/missingImage.png'
                });
            }
            expect(constructWithoutPixelsToCheck).toThrowDeveloperError();
        });

        it('requests the missing image url', function() {
            var missingImageUrl = 'http://some.host.invalid/missingImage.png';

            spyOn(Resource._Implementations, 'createImageBitmapFromBlob').and.callThrough();
            spyOn(Resource._Implementations, 'createImage').and.callFake(function(url, crossOrigin, deferred) {
                if (/^blob:/.test(url)) {
                    Resource._DefaultImplementations.createImage(url, crossOrigin, deferred);
                } else {
                    expect(url).toEqual(missingImageUrl);
                    Resource._DefaultImplementations.createImage('Data/Images/Red16x16.png', crossOrigin, deferred);
                }
            });

            Resource._Implementations.loadWithXhr = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
                expect(url).toEqual(missingImageUrl);
                return Resource._DefaultImplementations.loadWithXhr('Data/Images/Red16x16.png', responseType, method, data, headers, deferred);
            };

            var policy = new DiscardMissingTileImagePolicy({
                missingImageUrl : missingImageUrl,
                pixelsToCheck : [new Cartesian2(0, 0)]
            });

            return pollToPromise(function() {
                return policy.isReady();
            }).then(function() {
                if (FeatureDetection.supportsCreateImageBitmap()) {
                    expect(Resource._Implementations.createImageBitmapFromBlob).toHaveBeenCalled();
                } else {
                    expect(Resource._Implementations.createImage).toHaveBeenCalled();
                }
            });
        });
    });

    describe('shouldDiscardImage', function() {
        it('discards an image that is identical to the missing image', function() {
            var promises = [];

            promises.push(Resource.fetchImage('Data/Images/Red16x16.png'));
            promises.push(Resource.fetchImage('Data/Images/Green4x4.png'));

            var missingImageUrl = 'Data/Images/Red16x16.png';
            var policy = new DiscardMissingTileImagePolicy({
                missingImageUrl : missingImageUrl,
                pixelsToCheck : [new Cartesian2(0, 0)]
            });

            promises.push(pollToPromise(function() {
                return policy.isReady();
            }));

            return when.all(promises, function(results) {
                var redImage = results[0];
                var greenImage = results[1];

                expect(policy.shouldDiscardImage(redImage)).toEqual(true);
                expect(policy.shouldDiscardImage(greenImage)).toEqual(false);
            });
        });

        it('discards an image that is identical to the missing image even if the missing image is transparent', function() {
            var promises = [];

            promises.push(Resource.fetchImage('Data/Images/Transparent.png'));

            var missingImageUrl = 'Data/Images/Transparent.png';
            var policy = new DiscardMissingTileImagePolicy({
                missingImageUrl : missingImageUrl,
                pixelsToCheck : [new Cartesian2(0, 0)]
            });

            promises.push(pollToPromise(function() {
                return policy.isReady();
            }));

            return when.all(promises, function(results) {
                var transparentImage = results[0];
                expect(policy.shouldDiscardImage(transparentImage)).toEqual(true);
            });
        });

        it('does not discard at all when the missing image is transparent and disableCheckIfAllPixelsAreTransparent is set', function() {
            var promises = [];

            promises.push(Resource.fetchImage('Data/Images/Transparent.png'));

            var missingImageUrl = 'Data/Images/Transparent.png';
            var policy = new DiscardMissingTileImagePolicy({
                missingImageUrl : missingImageUrl,
                pixelsToCheck : [new Cartesian2(0, 0)],
                disableCheckIfAllPixelsAreTransparent : true
            });

            promises.push(pollToPromise(function() {
                return policy.isReady();
            }));

            return when.all(promises, function(results) {
                var transparentImage = results[0];
                expect(policy.shouldDiscardImage(transparentImage)).toEqual(false);
            });
        });

        it('throws if called before the policy is ready', function() {
            var policy = new DiscardMissingTileImagePolicy({
                missingImageUrl : 'Data/Images/Transparent.png',
                pixelsToCheck : [new Cartesian2(0, 0)],
                disableCheckIfAllPixelsAreTransparent : true
            });

            expect(function() {
                policy.shouldDiscardImage(new Image());
            }).toThrowDeveloperError();
        });
    });
});
