/*global define*/
define([
        '../Core/defined',
        '../Core/destroyObject',
        '../Core/Cartesian2',
        '../Core/Color',
        '../Renderer/createShaderSource',
        '../Renderer/ClearCommand',
        '../Renderer/PixelDatatype',
        '../Renderer/PixelFormat',
        '../Renderer/RenderbufferFormat',
        '../Shaders/PostProcessFilters/FXAA'
    ], function(
        defined,
        destroyObject,
        Cartesian2,
        Color,
        createShaderSource,
        ClearCommand,
        PixelDatatype,
        PixelFormat,
        RenderbufferFormat,
        FXAAFS) {
    "use strict";
    /*global WebGLRenderingContext*/

    /**
     * @private
     */
    var FXAA = function(context) {
        this.enabled = false;

        this._texture = undefined;
        this._depthTexture = undefined;
        this._depthRenderbuffer = undefined;
        this._fbo = undefined;
        this._command = undefined;

        var clearCommand = new ClearCommand();
        clearCommand.color = new Color(0.0, 0.0, 0.0, 0.0);
        clearCommand.depth = 1.0;
        clearCommand.owner = this;
        this._clearCommand = clearCommand;
    };

    function destroyResources(fxaa) {
        fxaa._fbo = fxaa._fbo && fxaa._fbo.destroy();
        fxaa._texture = fxaa._texture && fxaa._texture.destroy();
        fxaa._depthTexture = fxaa._depthTexture && fxaa._depthTexture.destroy();
        fxaa._depthRenderbuffer = fxaa._depthRenderbuffer && fxaa._depthRenderbuffer.destroy();

        fxaa._fbo = undefined;
        fxaa._texture = undefined;
        fxaa._depthTexture = undefined;
        fxaa._depthRenderbuffer = undefined;

        if (defined(fxaa._command)) {
            fxaa._command.shaderProgram = fxaa._command.shaderProgram && fxaa._command.shaderProgram.release();
            fxaa._command = undefined;
        }
    }

    FXAA.prototype.update = function(context) {
        if (!this.enabled) {
            if (defined(this._texture)) {
                destroyResources(this);
            }

            return;
        }

        var width = context.getDrawingBufferWidth();
        var height = context.getDrawingBufferHeight();

        var fxaaTexture = this._texture;
        var textureChanged = !defined(fxaaTexture) || fxaaTexture.getWidth() !== width || fxaaTexture.getHeight() !== height;
        if (textureChanged) {
            this._texture = this._texture && this._texture.destroy();
            this._depthTexture = this._depthTexture && this._depthTexture.destroy();
            this._depthRenderbuffer = this._depthRenderbuffer && this._depthRenderbuffer.destroy();

            this._texture = context.createTexture2D({
                width : width,
                height : height,
                pixelFormat : PixelFormat.RGB,
                pixelDatatype : PixelDatatype.UNSIGNED_BYTE
            });

            if (context.getDepthTexture()) {
                this._depthTexture = context.createTexture2D({
                    width : width,
                    height : height,
                    pixelFormat : PixelFormat.DEPTH_COMPONENT,
                    pixelDatatype : PixelDatatype.UNSIGNED_SHORT
                });
            } else {
                this._depthRenderbuffer = context.createRenderbuffer({
                    width : width,
                    height : height,
                    format : RenderbufferFormat.DEPTH_COMPONENT16
                });
            }
        }

        if (!defined(this._fbo) || textureChanged) {
            this._fbo = this._fbo && this._fbo.destroy();

            this._fbo = context.createFramebuffer({
                colorTextures : [this._texture],
                depthTexture : this._depthTexture,
                depthRenderbuffer : this._depthRenderbuffer,
                destroyAttachments : false
            });
        }

        if (!defined(this._command)) {
            var fs = createShaderSource({
                sources : [FXAAFS]
            });

            this._command = context.createViewportQuadCommand(fs, {
                renderState : context.createRenderState(),
                owner : this
            });
        }

        if (textureChanged) {
            var that = this;
            var step = new Cartesian2(1.0 / this._texture.getWidth(), 1.0 / this._texture.getHeight());
            this._command.uniformMap = {
                u_texture : function() {
                    return that._texture;
                },
                u_step : function() {
                    return step;
                }
            };
        }
    };

    FXAA.prototype.execute = function(context, passState) {
        if (!this.enabled) {
            return;
        }

        this._command.execute(context, passState);
    };

    FXAA.prototype.clear = function(context, passState, clearColor) {
        if(!this.enabled) {
            return;
        }

        var framebuffer = passState.framebuffer;

        passState.framebuffer = this._fbo;
        Color.clone(clearColor, this._clearCommand.color);
        this._clearCommand.execute(context, passState);

        passState.framebuffer = framebuffer;
    };

    FXAA.prototype.getColorFramebuffer = function() {
        if (!this.enabled) {
            return undefined;
        }

        return this._fbo;
    };

    FXAA.prototype.isDestroyed = function() {
        return false;
    };

    FXAA.prototype.destroy = function() {
        destroyResources(this);
        return destroyObject(this);
    };

    return FXAA;
});
