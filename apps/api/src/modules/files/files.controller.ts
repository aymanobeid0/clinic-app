import type { RequestHandler } from "express";
import { z } from "zod";
import {
  attachmentClassSchema,
  attachmentUploadSchema,
  attachmentRemoveSchema,
} from "@clinic/contracts";
import type { FilesService } from "./files.service.js";
import type { ClinicUpdates } from '../../clinic-updates.js';
import { AppError } from "../../errors/app-error.js";
const uuid = (v: unknown) => z.uuid().parse(v).toLowerCase();
export class FilesController {
  historical:RequestHandler=async(req,res)=>{
    if(req.query.output && req.query.output!=='inline') throw new AppError(403,'Sortie historique interdite.');
    const result=await this.service.historicalContent(req.session.actor,uuid(req.params.patientId),uuid(req.params.attachmentId),z.coerce.number().int().positive().parse(req.params.revision));
    // Slow responses must stop if the grant/session changes after the initial read.
    const actor=req.session.actor!;
    let checking=false;
    const verify=async()=>{
      if(checking || res.destroyed || res.writableEnded) return;
      checking=true;
      try {
        await new Promise<void>((resolve,reject)=>req.session.reload(error=>error?reject(error):resolve()));
        if(!req.session.actor || req.session.actor.accountId!==actor.accountId || req.session.actor.version!==actor.version || req.session.startedAt===undefined || this.now()-req.session.startedAt>=12*60*60*1000) throw new Error('Session expired');
        await this.service.authorizeHistoricalContent(req.session.actor,uuid(req.params.patientId),uuid(req.params.attachmentId),Number(req.params.revision));
      } catch {res.destroy();} finally {checking=false;}
    };
    const unsubscribe=this.updates.subscribe(actor.clinicId,()=>{void verify();});
    const timer=setInterval(()=>{void verify();},1000);
    const cleanup=()=>{clearInterval(timer);unsubscribe();};
    res.once('close',cleanup);res.once('finish',cleanup);
    await verify();
    if(res.destroyed) return;
    res.set('Content-Type',result.version.mediaType).set('Content-Disposition','inline; filename="attachment"').set('Content-Security-Policy',"sandbox; default-src 'none'").send(result.bytes);
  };
  constructor(readonly service: FilesService,readonly updates:ClinicUpdates,readonly now:()=>number) {}
  preflight: RequestHandler = async (req, _res, next) => {
    const data = attachmentUploadSchema.parse(req.query);
    await this.service.authorize(
      req.session.actor,
      uuid(req.params.patientId),
      data.classification,
      req.params.attachmentId ? "replace" : "upload",
    );
    next();
  };
  upload: RequestHandler = async (req, res) => {
    if (!Buffer.isBuffer(req.body))
      throw new AppError(400, "Corps binaire PDF, JPEG ou PNG requis.");
    const mediaType =
      req.get("content-type")?.split(";")[0]?.toLowerCase() ?? "";
    res.json(
      await this.service.upload(
        req.session.actor,
        uuid(req.params.patientId),
        req.params.attachmentId ? uuid(req.params.attachmentId) : undefined,
        attachmentUploadSchema.parse(req.query),
        req.body,
        mediaType,
        () => req.aborted || res.destroyed,
      ),
    );
  };
  list: RequestHandler = async (req, res) => {
    res.json(
      await this.service.list(
        req.session.actor,
        uuid(req.params.patientId),
        attachmentClassSchema.parse(req.query.classification),
      ),
    );
  };
  history: RequestHandler = async (req, res) => {
    res.json(
      await this.service.history(
        req.session.actor,
        uuid(req.params.patientId),
        uuid(req.params.attachmentId),
        attachmentClassSchema.parse(req.query.classification),
      ),
    );
  };
  remove: RequestHandler = async (req, res) => {
    res.json(
      await this.service.remove(
        req.session.actor,
        uuid(req.params.patientId),
        uuid(req.params.attachmentId),
        attachmentClassSchema.parse(req.query.classification),
        attachmentRemoveSchema.parse(req.body),
      ),
    );
  };
  content: RequestHandler = async (req, res) => {
    const output = z
      .enum(["inline", "download", "print"])
      .default("inline")
      .parse(req.query.output);
    const result = await this.service.content(
      req.session.actor,
      uuid(req.params.patientId),
      uuid(req.params.attachmentId),
      z.coerce.number().int().positive().parse(req.params.revision),
      attachmentClassSchema.parse(req.query.classification),
      output,
    );
    res.set("Content-Type", result.version.mediaType);
    res.set(
      "Content-Disposition",
      `${output === "download" ? "attachment" : "inline"}; filename="attachment"; filename*=UTF-8''${encodeURIComponent(result.version.name)}`,
    );
    res.set("Content-Security-Policy", "sandbox; default-src 'none'");
    res.send(result.bytes);
  };
}
